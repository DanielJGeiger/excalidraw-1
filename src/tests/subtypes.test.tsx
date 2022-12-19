import fallbackLangData from "./helpers/locales/en.json";
import {
  SubtypeRecord,
  SubtypeMethods,
  SubtypePrepFn,
  addSubtypeMethods,
  getSubtypeMethods,
  getSubtypeNames,
  hasAlwaysEnabledActions,
  isValidSubtype,
  selectSubtype,
  subtypeCollides,
} from "../subtypes";

import { render } from "./test-utils";
import { API } from "./helpers/api";
import ExcalidrawApp from "../excalidraw-app";

import { FontString, Theme } from "../element/types";
import { createIcon, iconFillColor } from "../components/icons";
import { SubtypeButton } from "../components/SubtypeButton";
import { registerAuxLangData } from "../i18n";
import { getFontString, getShortcutKey } from "../utils";
import * as textElementUtils from "../element/textElement";
import { isTextElement } from "../element";
import { mutateElement, newElementWith } from "../element/mutateElement";
import { AppState } from "../types";
import { getShortcutFromShortcutName } from "../actions/shortcuts";

const MW = 200;
const TWIDTH = 200;
const THEIGHT = 20;
const TBASELINE = 15;
const FONTSIZE = 20;
const DBFONTSIZE = 40;
const TRFONTSIZE = 60;

const getLangData = async (langCode: string): Promise<Object | undefined> => {
  try {
    const condData = await import(
      /* webpackChunkName: "locales/[request]" */ `./helpers/locales/${langCode}.json`
    );
    if (condData) {
      return condData;
    }
  } catch (e) {}
  return undefined;
};

const testSubtypeIcon = ({ theme }: { theme: Theme }) =>
  createIcon(
    <path
      stroke={iconFillColor(theme)}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />,
    { width: 40, height: 20, mirror: true },
  );

const test1: SubtypeRecord = {
  subtype: "test",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
  disabledNames: ["changeSloppiness"],
};

const test1Button = SubtypeButton(
  test1.subtype,
  test1.parents[0],
  testSubtypeIcon,
);
const test1NonParent = "text" as const;

const test2: SubtypeRecord = {
  subtype: "test2",
  parents: ["text"],
};

const test2Button = SubtypeButton(
  test2.subtype,
  test2.parents[0],
  testSubtypeIcon,
);

const test3: SubtypeRecord = {
  subtype: "test3",
  parents: ["text", "line"],
  shortcutMap: {
    testShortcut: [getShortcutKey("Shift+T")],
  },
  alwaysEnabledNames: ["test3Always"],
};

const test3Button = SubtypeButton(
  test3.subtype,
  test3.parents[0],
  testSubtypeIcon,
);

const cleanTestElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "roughness") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).roughness = 0;
  return oldUpdates;
} as SubtypeMethods["clean"];

const prepareNullSubtype = function () {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanTestElementUpdate;
  methods.measureText = measureTest2;
  methods.wrapText = wrapTest2;

  const actions = [test1Button, test2Button, test3Button];
  return { actions, methods };
} as SubtypePrepFn;

const prepareTest1Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanTestElementUpdate;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [test1Button];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const measureTest2: SubtypeMethods["measureText"] = function (
  element,
  next,
  maxWidth,
) {
  const text = next?.text ?? element.text;
  const customData = next?.customData ?? {};
  const fontSize = customData.triple
    ? TRFONTSIZE
    : next?.fontSize ?? element.fontSize;
  const fontFamily = element.fontFamily;
  const fontString = getFontString({ fontSize, fontFamily });
  const metrics = textElementUtils.measureText(text, fontString, maxWidth);
  const width = Math.max(metrics.width - 10, 0);
  const height = Math.max(metrics.height - 5, 0);
  return { width, height, baseline: metrics.baseline + 1 };
};

const wrapTest2: SubtypeMethods["wrapText"] = function (
  element,
  maxWidth,
  next,
) {
  const text = next?.text ?? element.originalText;
  if (next?.customData && next?.customData.triple === true) {
    return `${text.split(" ").join("\n")}\nHELLO WORLD.`;
  }
  if (next?.fontSize === DBFONTSIZE) {
    return `${text.split(" ").join("\n")}\nHELLO World.`;
  }
  return `${text.split(" ").join("\n")}\nHello world.`;
};

const prepareTest2Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {
    measureText: measureTest2,
    wrapText: wrapTest2,
  } as SubtypeMethods;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [test2Button];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const prepareTest3Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [test3Button];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const { h } = window;

describe("subtype registration", () => {
  it("should check for invalid subtype or parents", async () => {
    // Define invalid subtype records
    const null1 = {} as SubtypeRecord;
    const null2 = { subtype: "" } as SubtypeRecord;
    const null3 = { subtype: "null" } as SubtypeRecord;
    const null4 = { subtype: "null", parents: [] } as SubtypeRecord;
    // Try registering the invalid subtypes
    const prepN1 = API.addSubtype(null1, prepareNullSubtype);
    const prepN2 = API.addSubtype(null2, prepareNullSubtype);
    const prepN3 = API.addSubtype(null3, prepareNullSubtype);
    const prepN4 = API.addSubtype(null4, prepareNullSubtype);
    // Verify the guards in `prepareSubtype` worked
    expect(prepN1).toStrictEqual({ actions: null, methods: {} });
    expect(prepN2).toStrictEqual({ actions: null, methods: {} });
    expect(prepN3).toStrictEqual({ actions: null, methods: {} });
    expect(prepN4).toStrictEqual({ actions: null, methods: {} });
  });
  it("should return subtype actions and methods correctly", async () => {
    // Check initial registration works
    let prep1 = API.addSubtype(test1, prepareTest1Subtype);
    expect(prep1.actions).toStrictEqual([test1Button]);
    expect(prep1.methods).toStrictEqual({ clean: cleanTestElementUpdate });
    // Check repeat registration fails
    prep1 = API.addSubtype(test1, prepareNullSubtype);
    expect(prep1.actions).toBeNull();
    expect(prep1.methods).toStrictEqual({ clean: cleanTestElementUpdate });

    // Check initial registration works
    let prep2 = API.addSubtype(test2, prepareTest2Subtype);
    expect(prep2.actions).toStrictEqual([test2Button]);
    expect(prep2.methods).toStrictEqual({
      measureText: measureTest2,
      wrapText: wrapTest2,
    });
    // Check repeat registration fails
    prep2 = API.addSubtype(test2, prepareNullSubtype);
    expect(prep2.actions).toBeNull();
    expect(prep2.methods).toStrictEqual({
      measureText: measureTest2,
      wrapText: wrapTest2,
    });

    // Check initial registration works
    let prep3 = API.addSubtype(test3, prepareTest3Subtype);
    expect(prep3.actions).toStrictEqual([test3Button]);
    expect(prep3.methods).toStrictEqual({});
    // Check repeat registration fails
    prep3 = API.addSubtype(test3, prepareNullSubtype);
    expect(prep3.actions).toBeNull();
    expect(prep3.methods).toStrictEqual({});
  });
});

describe("subtypes", () => {
  it("should correctly register", async () => {
    const subtypes = getSubtypeNames();
    expect(subtypes).toContain(test1.subtype);
    expect(subtypes).toContain(test2.subtype);
    expect(subtypes).toContain(test3.subtype);
  });
  it("should return subtype methods", async () => {
    expect(getSubtypeMethods(undefined)).toBeUndefined();
    const test1Methods = getSubtypeMethods(test1.subtype);
    expect(test1Methods?.clean).toBeDefined();
    expect(test1Methods?.render).toBeUndefined();
    expect(test1Methods?.wrapText).toBeUndefined();
    expect(test1Methods?.renderSvg).toBeUndefined();
    expect(test1Methods?.measureText).toBeUndefined();
    expect(test1Methods?.ensureLoaded).toBeUndefined();
  });
  it("should not overwrite subtype methods", async () => {
    addSubtypeMethods(test1.subtype, {});
    addSubtypeMethods(test2.subtype, {});
    addSubtypeMethods(test3.subtype, { clean: cleanTestElementUpdate });
    const test1Methods = getSubtypeMethods(test1.subtype);
    expect(test1Methods?.clean).toBeDefined();
    const test2Methods = getSubtypeMethods(test2.subtype);
    expect(test2Methods?.measureText).toBeDefined();
    expect(test2Methods?.wrapText).toBeDefined();
    const test3Methods = getSubtypeMethods(test3.subtype);
    expect(test3Methods?.clean).toBeUndefined();
  });
  it("should register custom shortcuts", async () => {
    expect(getShortcutFromShortcutName("testShortcut")).toBe("Shift+T");
  });
  it("should correctly validate", async () => {
    test1.parents.forEach((p) => {
      expect(isValidSubtype(test1.subtype, p)).toBe(true);
      expect(isValidSubtype(undefined, p)).toBe(false);
    });
    expect(isValidSubtype(test1.subtype, test1NonParent)).toBe(false);
    expect(isValidSubtype(test1.subtype, undefined)).toBe(false);
    expect(isValidSubtype(undefined, undefined)).toBe(false);
  });
  it("should collide with themselves", async () => {
    expect(subtypeCollides(test1.subtype, [test1.subtype])).toBe(true);
    expect(subtypeCollides(test1.subtype, [test1.subtype, test2.subtype])).toBe(
      true,
    );
  });
  it("should not collide without type overlap", async () => {
    expect(subtypeCollides(test1.subtype, [test2.subtype])).toBe(false);
  });
  it("should collide with type overlap", async () => {
    expect(subtypeCollides(test1.subtype, [test3.subtype])).toBe(true);
  });
  it("should apply to ExcalidrawElements", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({ type: "line", id: "A", subtype: test1.subtype }),
          API.createElement({ type: "arrow", id: "B", subtype: test1.subtype }),
          API.createElement({
            type: "rectangle",
            id: "C",
            subtype: test1.subtype,
          }),
          API.createElement({
            type: "diamond",
            id: "D",
            subtype: test1.subtype,
          }),
          API.createElement({
            type: "ellipse",
            id: "E",
            subtype: test1.subtype,
          }),
        ],
      },
    });
    h.elements.forEach((el) => expect(el.subtype).toBe(test1.subtype));
  });
  it("should enforce prop value restrictions", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({
            type: "line",
            id: "A",
            subtype: test1.subtype,
            roughness: 1,
          }),
          API.createElement({ type: "line", id: "B", roughness: 1 }),
        ],
      },
    });
    h.elements.forEach((el) => {
      if (el.subtype === test1.subtype) {
        expect(el.roughness).toBe(0);
      } else {
        expect(el.roughness).toBe(1);
      }
    });
  });
  it("should consider enforced prop values in version increments", async () => {
    const rectA = API.createElement({
      type: "line",
      id: "A",
      subtype: test1.subtype,
      roughness: 1,
      strokeWidth: 1,
    });
    const rectB = API.createElement({
      type: "line",
      id: "B",
      subtype: test1.subtype,
      roughness: 1,
      strokeWidth: 1,
    });
    // Initial element creation checks
    expect(rectA.roughness).toBe(0);
    expect(rectB.roughness).toBe(0);
    expect(rectA.version).toBe(1);
    expect(rectB.version).toBe(1);
    // Check that attempting to set prop values not permitted by the subtype
    // doesn't increment element versions
    mutateElement(rectA, { roughness: 2 });
    mutateElement(rectB, { roughness: 2, strokeWidth: 2 });
    expect(rectA.version).toBe(1);
    expect(rectB.version).toBe(2);
    // Check that element versions don't increment when creating new elements
    // while attempting to use prop values not permitted by the subtype
    // First check based on `rectA` (unsuccessfully mutated)
    const rectC = newElementWith(rectA, { roughness: 1 });
    const rectD = newElementWith(rectA, { roughness: 1, strokeWidth: 1.5 });
    expect(rectC.version).toBe(1);
    expect(rectD.version).toBe(2);
    // Then check based on `rectB` (successfully mutated)
    const rectE = newElementWith(rectB, { roughness: 1 });
    const rectF = newElementWith(rectB, { roughness: 1, strokeWidth: 1.5 });
    expect(rectE.version).toBe(2);
    expect(rectF.version).toBe(3);
  });
  it("should call custom text methods", async () => {
    const testString = "A quick brown fox jumps over the lazy dog.";
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({
            type: "text",
            id: "A",
            subtype: test2.subtype,
            text: testString,
            fontSize: FONTSIZE,
          }),
        ],
      },
    });
    const mockMeasureText = (
      text: string,
      font: FontString,
      maxWidth?: number | null,
    ) => {
      if (text === testString) {
        let multiplier = 1;
        if (font.includes(`${DBFONTSIZE}`)) {
          multiplier = 2;
        }
        if (font.includes(`${TRFONTSIZE}`)) {
          multiplier = 3;
        }
        const width = maxWidth
          ? Math.min(multiplier * TWIDTH, maxWidth)
          : multiplier * TWIDTH;
        const height = multiplier * THEIGHT;
        const baseline = multiplier * TBASELINE;
        return { width, height, baseline };
      }
      return { width: 1, height: 0, baseline: 0 };
    };

    jest
      .spyOn(textElementUtils, "measureText")
      .mockImplementation(mockMeasureText);

    h.elements.forEach((el) => {
      if (isTextElement(el)) {
        // First test with `ExcalidrawTextElement.text`
        const metrics = textElementUtils.measureTextElement(el);
        expect(metrics).toStrictEqual({
          width: TWIDTH - 10,
          height: THEIGHT - 5,
          baseline: TBASELINE + 1,
        });
        const mMetrics = textElementUtils.measureTextElement(el, {}, MW);
        expect(mMetrics).toStrictEqual({
          width: Math.min(TWIDTH, MW) - 10,
          height: THEIGHT - 5,
          baseline: TBASELINE + 1,
        });
        const wrappedText = textElementUtils.wrapTextElement(el, MW);
        expect(wrappedText).toEqual(
          `${testString.split(" ").join("\n")}\nHello world.`,
        );

        // Now test with modified text in `next`
        let next: {
          text?: string;
          fontSize?: number;
          customData?: Record<string, any>;
        } = {
          text: "Hello world.",
        };
        const nextMetrics = textElementUtils.measureTextElement(el, next);
        expect(nextMetrics).toStrictEqual({ width: 0, height: 0, baseline: 1 });
        const nextWrappedText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextWrappedText).toEqual("Hello\nworld.\nHello world.");

        // Now test modified fontSizes in `next`
        next = { fontSize: DBFONTSIZE };
        const nextFM = textElementUtils.measureTextElement(el, next);
        expect(nextFM).toStrictEqual({
          width: 2 * TWIDTH - 10,
          height: 2 * THEIGHT - 5,
          baseline: 2 * TBASELINE + 1,
        });
        const nextFMW = textElementUtils.measureTextElement(el, next, MW);
        expect(nextFMW).toStrictEqual({
          width: Math.min(2 * TWIDTH, MW) - 10,
          height: 2 * THEIGHT - 5,
          baseline: 2 * TBASELINE + 1,
        });
        const nextFWrText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextFWrText).toEqual(
          `${testString.split(" ").join("\n")}\nHELLO World.`,
        );

        // Now test customData in `next`
        next = { customData: { triple: true } };
        const nextCD = textElementUtils.measureTextElement(el, next);
        expect(nextCD).toStrictEqual({
          width: 3 * TWIDTH - 10,
          height: 3 * THEIGHT - 5,
          baseline: 3 * TBASELINE + 1,
        });
        const nextCDMW = textElementUtils.measureTextElement(el, next, MW);
        expect(nextCDMW).toStrictEqual({
          width: Math.min(3 * TWIDTH, MW) - 10,
          height: 3 * THEIGHT - 5,
          baseline: 3 * TBASELINE + 1,
        });
        const nextCDWrText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextCDWrText).toEqual(
          `${testString.split(" ").join("\n")}\nHELLO WORLD.`,
        );
      }
    });
  });
  it("should recognize subtypes with always-enabled actions", async () => {
    expect(hasAlwaysEnabledActions(test1.subtype)).toBe(false);
    expect(hasAlwaysEnabledActions(test2.subtype)).toBe(false);
    expect(hasAlwaysEnabledActions(test3.subtype)).toBe(true);
  });
  it("should select active subtypes and customData", async () => {
    const appState = {} as {
      activeSubtypes: AppState["activeSubtypes"];
      customData: AppState["customData"];
    };

    // No active subtypes
    let subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBeUndefined();
    expect(subtypes.customData).toBeUndefined();
    // Subtype for both "text" and "line" types
    appState.activeSubtypes = [test3.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBe(test3.subtype);
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.subtype).toBe(test3.subtype);
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.subtype).toBeUndefined();
    // Subtype for multiple linear types
    appState.activeSubtypes = [test1.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBeUndefined();
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.subtype).toBe(test1.subtype);
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.subtype).toBe(test1.subtype);
    // Subtype for "text" only
    appState.activeSubtypes = [test2.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBe(test2.subtype);
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.subtype).toBeUndefined();
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.subtype).toBeUndefined();

    // Test customData
    appState.customData = {};
    appState.customData[test1.subtype] = { test: true };
    appState.customData[test2.subtype] = { test2: true };
    appState.customData[test3.subtype] = { test3: true };
    // Subtype for both "text" and "line" types
    appState.activeSubtypes = [test3.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBeUndefined();
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBe(true);
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBeUndefined();
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBe(true);
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.customData).toBeUndefined();
    // Subtype for multiple linear types
    appState.activeSubtypes = [test1.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.customData).toBeUndefined();
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBe(true);
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBeUndefined();
    // Multiple, non-colliding subtypes
    appState.activeSubtypes = [test1.subtype, test2.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBeUndefined();
    expect(subtypes.customData![test2.subtype]).toBe(true);
    expect(subtypes.customData![test3.subtype]).toBeUndefined();
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBe(true);
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBeUndefined();
  });
});
