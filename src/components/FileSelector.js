import { useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';

export function FileSelector({
  fileExtension,
  validator,
  onFileAccepted,
  onFileRejected,
  children,
}) {
  // Signals
  const fileTargetActive = useSignal(false);

  // Refs
  const fileInput = useRef(null);

  function fileTargetDragEnter(event) {
    event.preventDefault();
    fileTargetActive.value = true;
  }

  function fileTargetDragLeave() {
    fileTargetActive.value = false;
  }

  function fileTargetClick() {
    fileInput.current?.click();
  }

  function fileTargetDrop(event) {
    event.preventDefault();
    fileTargetActive.value = false;
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function fileInputChange(event) {
    const file = event.target.files[0];
    if (file) {
      handleFile(file);
    }
  }

  async function handleFile(file) {
    if (!validator) {
      onFileAccepted(file);
      return;
    }

    const validationError = await validator(file);
    if (validationError) {
      onFileRejected(file, validationError);
    } else {
      onFileAccepted(file);
    }
  }

  return html`
    <input
      type="file"
      class="hidden"
      ref=${fileInput}
      onChange=${fileInputChange}
      accept=${fileExtension}
    />

    <div
      class=${fileTargetActive.value ? 'file-target active' : 'file-target'}
      onClick=${fileTargetClick}
      onDragEnter=${fileTargetDragEnter}
      onDragLeave=${fileTargetDragLeave}
      onDragOver=${(e) => e.preventDefault()}
      onDrop=${fileTargetDrop}
    >
      ${children}
    </div>
  `;
}
