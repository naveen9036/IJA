import mammoth from 'mammoth';

export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ arrayBuffer: data });
  return value;
}
