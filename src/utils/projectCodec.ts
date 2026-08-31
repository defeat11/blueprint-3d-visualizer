/**
 * Utility for encoding and decoding project data to a Base64 string.
 */

export function encodeProject(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    const encoded = btoa(encodeURIComponent(jsonString));
    return encoded;
  } catch (error) {
    console.error('Error encoding project:', error);
    return '';
  }
}

export function decodeProject(code: string): any {
  try {
    const decoded = decodeURIComponent(atob(code));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding project:', error);
    return null;
  }
}
