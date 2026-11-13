import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { GoldShort, GOLD_FRAMES } from "./videos/gold/Gold";
import { AjdadEp1, AJDAD1_FRAMES } from "./videos/ajdad1/Ajdad";
import { AjdadEp2, AJDAD2_FRAMES } from "./videos/ajdad2/Ajdad";
import { AjdadEp3, AJDAD3_FRAMES } from "./videos/ajdad3/Ajdad";
import { AjdadEp4, AJDAD4_FRAMES } from "./videos/ajdad4/Ajdad";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GoldShort" component={GoldShort} durationInFrames={GOLD_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AjdadEp1" component={AjdadEp1} durationInFrames={AJDAD1_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AjdadEp2" component={AjdadEp2} durationInFrames={AJDAD2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AjdadEp3" component={AjdadEp3} durationInFrames={AJDAD3_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AjdadEp4" component={AjdadEp4} durationInFrames={AJDAD4_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
