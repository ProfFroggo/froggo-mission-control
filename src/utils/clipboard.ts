/**
 * Safely copy text to clipboard with fallback for permission errors
 * @param text Text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for when clipboard API fails (permissions, non-HTTPS, etc.)
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      const success = document.execCommand('copy');
      return success;
    } catch (fallbackErr) {
      console.error('Clipboard copy failed:', err, fallbackErr);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
