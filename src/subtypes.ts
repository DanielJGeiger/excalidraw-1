import { useEffect } from "react";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "./element/types";
import { getNonDeletedElements } from "./element";
import { getSelectedElements } from "./scene";
import { AppState } from "./types";

import { Action, ActionName } from "./actions/types";
import { register } from "./actions/register";
import { hasBoundTextElement } from "./element/typeChecks";
import { getBoundTextElement } from "./element/textElement";

// Use "let" instead of "const" so we can dynamically add subtypes
let customSubtypes: readonly CustomSubtype[] = [];
let customParents: SubtypeTypes["parents"] = [];
let customProps: SubtypeTypes["customProps"] = [];
let customActions: SubtypeTypes["customActions"] = [];
let disabledActions: SubtypeTypes["disabledActions"] = [];
let customShortcutNames: SubtypeTypes["customShortcutNames"] = [];
let customShortcutMap: SubtypeTypes["customShortcutMap"] = {};

export type SubtypeTypes = Readonly<{
  subtype: CustomSubtype;
  parents: readonly {
    subtype: CustomSubtype;
    parentType: ExcalidrawElement["type"];
  }[];
  customProps: readonly CustomProps[];
  customActions: readonly {
    subtype: CustomSubtype;
    actions: CustomActionName[];
  }[];
  disabledActions: readonly {
    subtype: CustomSubtype;
    actions: DisabledActionName[];
  }[];
  customShortcutNames: readonly CustomShortcutName[];
  customShortcutMap: Record<CustomShortcutName, string[]>;
}>;

// Custom Subtypes
export type CustomSubtype = string;
export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtypes;
};
export const isValidSubtype = (s: any, t: any): s is CustomSubtype =>
  customParents.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;
const isSubtype = (s: any): s is CustomSubtype => customSubtypes.includes(s);

// Custom Properties
export type CustomProps = any;

// Custom Actions
export type CustomActionName = string;

const isCustomActionName = (s: any): s is CustomActionName =>
  customActions.some((val) => val.actions.includes(s));

const customActionMap: Action[] = [];
export const getCustomActions = (): readonly Action[] => {
  return customActionMap;
};

const addCustomAction = (action: Action) => {
  if (isCustomActionName(action.name)) {
    if (customActionMap.every((value) => value.name !== action.name)) {
      customActionMap.push(action);
      register(action);
    }
  }
};

// Standard actions disabled by subtypes
type DisabledActionName = ActionName;

const isDisabledActionName = (s: any): s is DisabledActionName =>
  disabledActions.some((val) => val.actions.includes(s));

export const isActionEnabled = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  actionName: ActionName | CustomActionName,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  const chosen = appState.editingElement
    ? [appState.editingElement, ...selectedElements]
    : selectedElements;
  let enabled = chosen.some((el) =>
    customParents.some((parent) => {
      const e = hasBoundTextElement(el) ? getBoundTextElement(el)! : el;
      return (
        ((el.type === parent.parentType && el.subtype === undefined) ||
          (e.type === parent.parentType && e.subtype === undefined)) &&
        !isCustomActionName(actionName)
      );
    }),
  );
  enabled =
    enabled ||
    (chosen.length === 0 &&
      (appState.activeSubtype === undefined ||
        isActionForSubtype(appState.activeSubtype, actionName)));
  !enabled &&
    chosen.forEach((el) => {
      const subtype = hasBoundTextElement(el)
        ? getBoundTextElement(el)!.subtype
        : el.subtype;
      if (!enabled && isActionForSubtype(subtype, actionName)) {
        enabled = true;
      }
    });
  if (isSubtype(actionName)) {
    enabled = true;
  }
  return enabled;
};

const isActionForSubtype = (
  subtype: CustomSubtype | undefined,
  action: ActionName | CustomActionName,
) => {
  const name = action as DisabledActionName;
  const customName = action as CustomActionName;
  if (subtype && isSubtype(subtype)) {
    return (
      !disabledActions // Not disabled by subtype
        .find((value) => value.subtype === subtype)!
        .actions.includes(name) ||
      customActions // Added by subtype
        .find((value) => value.subtype === subtype)!
        .actions.includes(customName)
    );
  }
  return !isCustomActionName(action) && !isDisabledActionName(action);
};

// Custom Shortcuts (for custom actions)
export type CustomShortcutName = string;
export const isCustomShortcutName = (s: any): s is CustomShortcutName =>
  customShortcutNames.includes(s);

// Return the shortcut by CustomShortcutName
export const getCustomShortcutKey = (name: CustomShortcutName) => {
  let shortcuts: string[] = [];
  if (isCustomShortcutName(name)) {
    shortcuts = customShortcutMap[name];
  }
  return shortcuts;
};

// Custom Methods
export type CustomMethods = {
  clean: (
    updates: Omit<
      Partial<ExcalidrawElement>,
      "id" | "version" | "versionNonce"
    >,
  ) => Omit<Partial<ExcalidrawElement>, "id" | "version" | "versionNonce">;
  ensureLoaded: (callback?: () => void) => Promise<void>;
  measureText: (
    element: Pick<
      ExcalidrawTextElement,
      "subtype" | "customProps" | "fontSize" | "fontFamily" | "text"
    >,
    next?: {
      fontSize?: number;
      text?: string;
      customProps?: CustomProps;
    },
    maxWidth?: number | null,
  ) => { width: number; height: number; baseline: number };
  render: (
    element: NonDeleted<ExcalidrawElement>,
    context: CanvasRenderingContext2D,
    renderCb?: () => void,
  ) => void;
  renderSvg: (
    svgRoot: SVGElement,
    root: SVGElement,
    element: NonDeleted<ExcalidrawElement>,
    opt?: { offsetX?: number; offsetY?: number },
  ) => void;
  wrapText: (
    element: Pick<
      ExcalidrawTextElement,
      "subtype" | "customProps" | "fontSize" | "fontFamily" | "originalText"
    >,
    containerWidth: number,
    next?: {
      fontSize?: number;
      text?: string;
      customProps?: CustomProps;
    },
  ) => string;
};

type MethodMap = { subtype: CustomSubtype; methods: CustomMethods };
const methodMaps = [] as Array<MethodMap>;

// Assumption: prepareSubtypes() has run first or is the caller.
// Use `getCustomMethods` to call subtype-specialized methods, like `render`.
export const getCustomMethods = (subtype: CustomSubtype | undefined) => {
  const map = methodMaps.find((method) => method.subtype === subtype);
  return map?.methods;
};

// Functions to prepare subtypes for use
export type SubtypePrepFn = (
  methods: CustomMethods,
  addCustomAction: (action: Action) => void,
  onSubtypeLoaded?: (
    hasSubtype: (element: ExcalidrawElement) => boolean,
  ) => void,
) => void;

const subtypePreps: { [key: CustomSubtype]: SubtypePrepFn } = {};

// Hook to register the subtype so it can be prepared for use
// when `prepareSubtypes()` is called.
export const useSubtypePrep = (
  subtypeTypes: SubtypeTypes,
  prepareSubtype: SubtypePrepFn,
  enabled: boolean,
) => {
  useEffect(() => setSubtypeTypes(subtypeTypes, enabled));
  subtypePreps[subtypeTypes.subtype] = prepareSubtype;
};

// This is a non-hook form of `useSubtypePrep` for use in the
// test helper API constructor.
export const testSubtypePrep = (
  subtypeTypes: SubtypeTypes,
  prepareSubtype: SubtypePrepFn,
  enabled: boolean,
) => {
  setSubtypeTypes(subtypeTypes, enabled);
  subtypePreps[subtypeTypes.subtype] = prepareSubtype;
};

// The following method populates the typename arrays.
// This MUST be done before calling prepareSubtypes().
// The `enabled` parameter allows using this inside hooks.
const setSubtypeTypes = (types: SubtypeTypes, enabled: boolean) => {
  if (!enabled || customSubtypes.includes(types.subtype)) {
    return;
  }
  customSubtypes = [...customSubtypes, types.subtype];
  customParents = [...customParents, ...types.parents];
  customProps = [...customProps, ...types.customProps];
  customActions = [...customActions, ...types.customActions];
  disabledActions = [...disabledActions, ...types.disabledActions];
  customShortcutNames = [...customShortcutNames, ...types.customShortcutNames];
  customShortcutMap = { ...customShortcutMap, ...types.customShortcutMap };
};

// Prepare all custom subtypes.  Each subtype must first be registered
// with `useSubtypePrep` or `testSubtypePrep` respectively.  This calls
// the `SubtypePrepFn` provided at subtype registration.  The optional
// `onSubtypeLoaded` callback may be used to re-render subtyped
// `ExcalidrawElement`s after the subtype has finished async loading.
// See the MathJax plugin in `@excalidraw/plugins` for example.
export const prepareSubtypes = (
  onSubtypeLoaded?: (
    hasSubtype: (element: ExcalidrawElement) => boolean,
  ) => void,
) => {
  customSubtypes.forEach((subtype) => {
    if (!methodMaps.find((method) => method.subtype === subtype)) {
      const methods = {} as CustomMethods;
      methodMaps.push({ subtype, methods });
      const prepareSubtype = subtypePreps[subtype];
      prepareSubtype(methods, addCustomAction, onSubtypeLoaded);
    }
  });
};

// Ensure all subtypes are loaded before continuing, eg to
// render SVG previews of new charts.  Chart-relevant subtypes
// include math equations in titles or non hand-drawn line styles.
export const ensureSubtypesLoaded = async (
  elements: readonly ExcalidrawElement[],
  callback?: () => void,
) => {
  // Only ensure the loading of subtypes which are actually needed.
  // We don't want to be held up by eg downloading the MathJax SVG fonts
  // if we don't actually need them yet.
  const subtypesUsed = [] as CustomSubtype[];
  elements.forEach((el) => {
    if (
      "subtype" in el &&
      isValidSubtype(el.subtype, el.type) &&
      !subtypesUsed.includes(el.subtype)
    ) {
      subtypesUsed.push(el.subtype);
    }
  });
  // Use a for loop so we can do `await map.ensureLoaded()`
  for (let i = 0; i < subtypesUsed.length; i++) {
    const subtype = subtypesUsed[i];
    // Should be defined if prepareSubtypes() has run
    const map = getCustomMethods(subtype)!;
    await map.ensureLoaded();
  }
  if (callback) {
    callback();
  }
};
