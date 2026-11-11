import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { GoldShort, GOLD_FRAMES } from "./videos/gold/Gold";
import { AjdadEp1, AJDAD1_FRAMES } from "./videos/ajdad1/Ajdad";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GoldShort" component={GoldShort} durationInFrames={GOLD_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AjdadEp1" component={AjdadEp1} durationInFrames={AJDAD1_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
