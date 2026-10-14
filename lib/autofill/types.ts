export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'contenteditable';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDescriptor {
  /** Matches the `data-ija-id` attribute set on the element(s). */
  id: string;
  kind: FieldKind;
  label: string;
  name: string;
  idAttr: string;
  autocomplete: string;
  placeholder: string;
  required: boolean;
  options?: FieldOption[];
  accept?: string;
  maxLength?: number;
  currentValue: string;
}

export interface FrameFields {
  frameUrl: string;
  fields: FieldDescriptor[];
}

export interface FileRef {
  name: string;
  type: string;
  base64: string;
}

export interface FillItem {
  id: string;
  value?: string;
  optionValue?: string;
  checked?: boolean;
  file?: FileRef;
  /** Only outline the field for the user to check; don't change it. */
  review?: boolean;
}

export interface FillPlan {
  items: FillItem[];
  overwrite?: boolean;
}

export interface FillResult {
  id: string;
  status: 'filled' | 'skipped' | 'failed' | 'marked';
  reason?: string;
}

export interface CollectedValue {
  id: string;
  value: string;
}

/** Functions the content script exposes on `globalThis.__ija` in the extension's isolated world. */
export interface PageApi {
  detect(): FrameFields;
  fill(plan: FillPlan): FillResult[];
  collect(ids: string[]): CollectedValue[];
}
