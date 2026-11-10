import { Config } from "@remotion/cli/config";
// Linux container: use the preinstalled Chromium instead of downloading one
Config.setBrowserExecutable(process.env.REMOTION_BROWSER || "/opt/pw-browsers/chromium");
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as "angle" | "swangle") || "angle"); // REMOTION_GL=swangle without a GPU
