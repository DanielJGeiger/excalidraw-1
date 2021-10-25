import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "../element/types";
import { ElementUpdate, mutateElement } from "../element/mutateElement";
import { getNonDeletedElements, isTextElement } from "../element";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";

import { registerTextElementSubtypeText } from "./text";

import { TextActionName, TextOpts, TextShortcutName } from "./types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";

type TextLikeMethodName =
  | "apply"
  | "clean"
  | "measure"
  | "render"
  | "renderSvg"
  | "restore";

type TextLikeMethod = {
  subtype: string;
  method: Function;
  default?: boolean;
};

type TextLikeMethods = Array<TextLikeMethod>;

const applyMethodsA = [] as TextLikeMethods;
const cleanMethodsA = [] as TextLikeMethods;
const measureMethodsA = [] as TextLikeMethods;
const renderMethodsA = [] as TextLikeMethods;
const renderSvgMethodsA = [] as TextLikeMethods;
const restoreMethodsA = [] as TextLikeMethods;

// One element for each ExcalidrawTextElement subtype.
// ShortcutMap arrays, then typeguards for these.
type TextShortcutMapArray = Array<Record<string, string[]>>;
const textShortcutMaps: TextShortcutMapArray = [];
type TextShortcutNameChecks = Array<Function>;
const textShortcutNameChecks: TextShortcutNameChecks = [];

// Register shortcutMap and typeguard for subtype
export const registerTextLikeShortcutNames = (
  textShortcutMap: Record<string, string[]>,
  isTextShortcutNameCheck: Function,
): void => {
  // If either textShortcutMap or isTextShortcutNameCheck is already registered, do nothing
  if (
    !textShortcutMaps.includes(textShortcutMap) &&
    !textShortcutNameChecks.includes(isTextShortcutNameCheck)
  ) {
    textShortcutMaps.push(textShortcutMap);
    textShortcutNameChecks.push(isTextShortcutNameCheck);
  }
};

// Typeguard for TextShortcutName (including all subtypes)
export const isTextShortcutName = (s: any): s is TextShortcutName => {
  for (let i = 0; i < textShortcutNameChecks.length; i++) {
    if (textShortcutNameChecks[i](s)) {
      return true;
    }
  }
  return false;
};

// Return the shortcut by TextShortcutName.
// Assume textShortcutMaps and textShortcutNameChecks are matchingly sorted.
export const getShortcutFromTextShortcutName = (name: TextShortcutName) => {
  let shortcuts: string[] = [];
  for (let i = 0; i < textShortcutMaps.length; i++) {
    if (textShortcutNameChecks[i](name)) {
      shortcuts = textShortcutMaps[i][name];
    }
  }
  return shortcuts;
};

export const registerTextLikeMethod = (
  name: TextLikeMethodName,
  textLikeMethod: TextLikeMethod,
): void => {
  let methodsA: TextLikeMethods;
  switch (name) {
    case "apply":
      methodsA = applyMethodsA;
      break;
    case "clean":
      methodsA = cleanMethodsA;
      break;
    case "measure":
      methodsA = measureMethodsA;
      break;
    case "render":
      methodsA = renderMethodsA;
      break;
    case "restore":
      methodsA = restoreMethodsA;
      break;
    case "renderSvg":
      methodsA = renderSvgMethodsA;
      break;
  }
  if (!methodsA.includes(textLikeMethod)) {
    methodsA.push(textLikeMethod);
  }
};

const textLikeSubtypes = Array<string>();

export const getTextElementSubtypes = (): string[] => {
  return textLikeSubtypes;
};

export const registerTextLikeSubtypeName = (subtypeName: string) => {
  // Only register a subtype name once
  if (!textLikeSubtypes.includes(subtypeName)) {
    textLikeSubtypes.push(subtypeName);
  }
};

type DisabledPanelComponents = {
  subtype: string;
  actions: ActionName[];
};

const textLikeDisabledPanelComponents = [] as DisabledPanelComponents[];

export const registerTextLikeDisabledPanelComponents = (
  subtypeName: string,
  actions: ActionName[],
) => {
  if (textLikeSubtypes.includes(subtypeName)) {
    textLikeDisabledPanelComponents.push({
      subtype: subtypeName,
      actions,
    } as DisabledPanelComponents);
  }
};

export const isPanelComponentDisabled = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  actionName: ActionName | TextActionName,
) => {
  let disabled = false;
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  selectedElements.forEach((element) => {
    if (isTextElement(element)) {
      if (isPanelComponentDisabledForSubtype(element.subtype, actionName)) {
        disabled = true;
      }
    }
  });
  if (
    selectedElements.length === 0 &&
    isPanelComponentDisabledForSubtype(
      appState.textElementSubtype,
      actionName,
    ) &&
    !(appState.editingElement && isTextElement(appState.editingElement))
  ) {
    disabled = true;
  }
  if (
    appState.editingElement &&
    isTextElement(appState.editingElement) &&
    isPanelComponentDisabledForSubtype(
      appState.editingElement.subtype,
      actionName,
    )
  ) {
    disabled = true;
  }
  return !disabled;
};

const isPanelComponentDisabledForSubtype = (
  subtypeName: string,
  action: ActionName,
) => {
  if (textLikeSubtypes.includes(subtypeName)) {
    if (
      textLikeDisabledPanelComponents
        .find((value, index, disabledComponent) => {
          return value.subtype === subtypeName;
        })!
        .actions.includes(action)
    ) {
      return true;
    }
  }
  return false;
};

export const applyTextOpts = (
  element: ExcalidrawTextElement,
  textOpts?: TextOpts,
): ExcalidrawTextElement => {
  mutateElement(element, cleanTextOptUpdates(element, element));
  for (let i = 0; i < applyMethodsA.length; i++) {
    if (applyMethodsA[i].subtype === element.subtype) {
      return applyMethodsA[i].method(element, textOpts);
    }
  }
  return applyMethodsA
    .find((value, index, applyMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, textOpts);
};

export const cleanTextOptUpdates = (
  element: ExcalidrawTextElement,
  opts: ElementUpdate<ExcalidrawTextElement>,
): ElementUpdate<ExcalidrawTextElement> => {
  for (let i = 0; i < cleanMethodsA.length; i++) {
    if (cleanMethodsA[i].subtype === element.subtype) {
      return cleanMethodsA[i].method(opts);
    }
  }
  return cleanMethodsA
    .find((value, index, cleanMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(opts);
};

export const measureTextElement = (
  element: Omit<
    ExcalidrawTextElement,
    | "id"
    | "isDeleted"
    | "type"
    | "baseline"
    | "width"
    | "height"
    | "angle"
    | "seed"
    | "version"
    | "versionNonce"
    | "groupIds"
    | "boundElementIds"
  >,
  next?: {
    fontSize?: number;
    text?: string;
  },
): { width: number; height: number; baseline: number } => {
  for (let i = 0; i < measureMethodsA.length; i++) {
    if (measureMethodsA[i].subtype === element.subtype) {
      return measureMethodsA[i].method(element, next);
    }
  }
  return measureMethodsA
    .find((value, index, measureMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, next);
};

export const renderTextElement = (
  element: NonDeleted<ExcalidrawTextElement>,
  context: CanvasRenderingContext2D,
  refresh?: () => void,
): void => {
  for (let i = 0; i < renderMethodsA.length; i++) {
    if (renderMethodsA[i].subtype === element.subtype) {
      renderMethodsA[i].method(element, context, refresh);
      return;
    }
  }
  renderMethodsA
    .find((value, index, renderMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, context, refresh);
};

export const renderSvgTextElement = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElement>,
): void => {
  for (let i = 0; i < renderSvgMethodsA.length; i++) {
    if (renderSvgMethodsA[i].subtype === element.subtype) {
      renderSvgMethodsA[i].method(svgRoot, node, element);
      return;
    }
  }
  renderSvgMethodsA
    .find((value, index, renderSvgMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(svgRoot, node, element);
};

export const restoreTextElement = (
  element: ExcalidrawTextElement,
  elementRestored: ExcalidrawTextElement,
): ExcalidrawTextElement => {
  for (let i = 0; i < restoreMethodsA.length; i++) {
    if (restoreMethodsA[i].subtype === element.subtype) {
      return restoreMethodsA[i].method(element, elementRestored);
    }
  }
  return restoreMethodsA
    .find((value, index, restoreMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, elementRestored);
};

export const registerTextElementSubtypes = (
  onSubtypesLoaded?: (isTextElementSubtype: Function) => void,
) => {
  registerTextElementSubtypeText(onSubtypesLoaded);
};

const textLikeActions: Action[] = [];

export const addTextLikeActions = (actions: Action[]) => {
  actions.forEach((action) => {
    if (
      textLikeActions.every((value, index, actions) => {
        return value.name !== action.name;
      })
    ) {
      textLikeActions.push(action);
      register(action);
    }
  });
};

export const getTextLikeActions = (): readonly Action[] => {
  return textLikeActions;
};
