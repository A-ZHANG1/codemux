import { describe, expect, it } from "vitest";
import { isValidSharedSettingValue } from "../../../shared/settings-keys";

describe("isValidSharedSettingValue", () => {
  it.each(["lavender", "light", "dark", "system"])("accepts the %s theme for host persistence", (theme) => {
    expect(isValidSharedSettingValue("theme", theme)).toBe(true);
  });

  it.each(["unknown", "", null, 1, {}])("rejects invalid theme %j", (theme) => {
    expect(isValidSharedSettingValue("theme", theme)).toBe(false);
  });
});
