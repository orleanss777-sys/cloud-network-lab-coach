import type { Lab } from "./types";
import { lab as nsgDenySsh } from "./labs/nsg-deny-ssh";
import { lab as missingPublicIp } from "./labs/missing-public-ip";
import { lab as nsgMissing443 } from "./labs/nsg-missing-443";
import { lab as udrBlackhole } from "./labs/udr-blackhole";
import { lab as peeringOneWay } from "./labs/peering-one-way";
import { lab as dnsZoneNolink } from "./labs/dns-zone-nolink";
import { lab as lbProbePort } from "./labs/lb-probe-port";
import { lab as asymmetricUdr } from "./labs/asymmetric-udr";
import { lab as azfwMissing443 } from "./labs/azfw-missing-443";
import { lab as vpnOverlap } from "./labs/vpn-overlap";
import { lab as peeringNotTransitive } from "./labs/peering-not-transitive";
import { lab as defaultOutboundGone } from "./labs/default-outbound-gone";

export const LABS: Lab[] = [
  nsgDenySsh,
  missingPublicIp,
  nsgMissing443,
  udrBlackhole,
  peeringOneWay,
  dnsZoneNolink,
  lbProbePort,
  asymmetricUdr,
  azfwMissing443,
  vpnOverlap,
  peeringNotTransitive,
  defaultOutboundGone,
];

export function labsByDifficulty(d: Lab["difficulty"]): Lab[] {
  return LABS.filter((l) => l.difficulty === d);
}

export function getLab(id: string): Lab | undefined {
  return LABS.find((l) => l.id === id);
}

export function pickLab(difficulty: Lab["difficulty"], excludeIds: string[] = []): Lab {
  const pool = labsByDifficulty(difficulty);
  const fresh = pool.filter((l) => !excludeIds.includes(l.id));
  const src = fresh.length ? fresh : pool;
  return src[Math.floor(Math.random() * src.length)] ?? pool[0];
}
