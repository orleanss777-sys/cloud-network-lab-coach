export type Difficulty = "iniciante" | "n2" | "n3" | "cne";

export type TechKey =
  | "vnet"
  | "subnet"
  | "nsg"
  | "route-table"
  | "dns"
  | "private-ip"
  | "public-ip"
  | "peering"
  | "load-balancer"
  | "vpn"
  | "firewall"
  | "ports";

export type Severity = "Sev1" | "Sev2" | "Sev3" | "Sev4";

export type NodeKind =
  | "internet"
  | "onprem"
  | "vnet"
  | "subnet"
  | "vm"
  | "nsg"
  | "fw"
  | "lb"
  | "vpn"
  | "dns"
  | "pip"
  | "nva"
  | "sql";

export type NodeStatus = "ok" | "warn" | "error" | "idle";

export interface TopologyNode {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  parentId?: string;
  status?: NodeStatus;
}

export interface TopologyEdge {
  from: string;
  to: string;
  label?: string;
  kind?: "ok" | "blocked" | "dashed" | "vpn";
}

export interface NsgRule {
  name: string;
  priority: number;
  direction: "Inbound" | "Outbound";
  access: "Allow" | "Deny";
  protocol: "Tcp" | "Udp" | "*";
  source: string;
  sourcePort: string;
  dest: string;
  destPort: string;
}

export interface Route {
  name: string;
  prefix: string;
  nextHopType: string;
  nextHopIp?: string;
}

export interface Subnet {
  name: string;
  prefix: string;
  nsg?: string;
  routeTable?: string;
}

export interface Vnet {
  name: string;
  space: string[];
  dns?: string[];
  subnets: Subnet[];
}

export interface Vm {
  name: string;
  os: "linux" | "windows";
  vnet: string;
  subnet: string;
  privateIp: string;
  publicIp?: string;
  nsg?: string;
  nic: string;
  power: "VM running" | "VM deallocated";
  size: string;
}

export interface Peering {
  name: string;
  vnet: string;
  remote: string;
  allowForwarded: boolean;
  allowGateway: boolean;
  useRemoteGw: boolean;
  state: "Connected" | "Initiated" | "Disconnected";
}

export interface LbBackend {
  name: string;
  ip: string;
  healthy: boolean;
}

export interface LoadBalancer {
  name: string;
  sku: string;
  frontend: string;
  probes: { name: string; proto: string; port: number; path?: string }[];
  rules: {
    name: string;
    frontendPort: number;
    backendPort: number;
    proto: string;
    probe: string;
  }[];
  backends: LbBackend[];
  outboundRules: string[];
}

export interface Firewall {
  name: string;
  privateIp: string;
  policy: string;
  networkRules: {
    name: string;
    source: string;
    dest: string;
    ports: string;
    proto: string;
    action: string;
  }[];
  appRules: {
    name: string;
    source: string;
    fqdn: string;
    protocols: string;
  }[];
}

export interface VpnConnection {
  name: string;
  status: string;
  gateway: string;
  local: string;
  remote: string;
  localPrefixes: string[];
  remotePrefixes: string[];
  overlap?: boolean;
}

export interface DnsZone {
  name: string;
  records: { name: string; type: string; value: string }[];
  links: { name: string; vnet: string }[];
}

export interface PublicIp {
  name: string;
  ip: string;
  sku: string;
  attachedTo?: string;
}

export interface Connectivity {
  from: string;
  to: string;
  port?: number;
  proto: "icmp" | "tcp" | "udp" | "dns";
  result: "ok" | "timeout" | "reject" | "no-route" | "nxdomain";
  note?: string;
}

export interface LabWorld {
  subscription: string;
  subscriptionId: string;
  resourceGroup: string;
  location: string;
  vnets: Vnet[];
  nsgs: { name: string; rules: NsgRule[] }[];
  routeTables: { name: string; routes: Route[]; disableBgp?: boolean }[];
  vms: Vm[];
  peerings: Peering[];
  lbs: LoadBalancer[];
  firewalls: Firewall[];
  vpns: VpnConnection[];
  dnsZones: DnsZone[];
  publicIps: PublicIp[];
}

export interface Hypothesis {
  id: string;
  label: string;
  correct: boolean;
}

export interface Lab {
  id: string;
  code: string;
  title: string;
  difficulty: Difficulty;
  technologies: TechKey[];
  severity: Severity;
  etaMin: number;
  ticket: {
    title: string;
    reporter: string;
    service: string;
    openedAt: string;
    description: string;
    symptoms: string[];
    impact: string;
    lastChange?: string;
  };
  topology: { nodes: TopologyNode[]; edges: TopologyEdge[] };
  world: LabWorld;
  connectivity: Connectivity[];
  hypotheses: Hypothesis[];
  hints: string[];
  debrief: {
    rootCause: string;
    solution: string;
    commands: string[];
    conceptTitle: string;
    concept: string;
    prevention: string;
  };
}

export interface LabResult {
  labId: string;
  code: string;
  title: string;
  difficulty: Difficulty;
  score: number;
  hintsUsed: number;
  wrongGuesses: number;
  durationSec: number;
  revealed: boolean;
  at: string;
  technologies: TechKey[];
}

export interface TerminalLine {
  id: string;
  kind: "in" | "out" | "sys";
  text: string;
}

export const TECH_META: Record<TechKey, { label: string; short: string }> = {
  vnet: { label: "Azure Virtual Network", short: "VNet" },
  subnet: { label: "Subnets", short: "Subnet" },
  nsg: { label: "Network Security Groups", short: "NSG" },
  "route-table": { label: "Route Tables / UDR", short: "UDR" },
  dns: { label: "DNS privado", short: "DNS" },
  "private-ip": { label: "Private IP", short: "Priv IP" },
  "public-ip": { label: "Public IP", short: "Pub IP" },
  peering: { label: "VNet Peering", short: "Peering" },
  "load-balancer": { label: "Load Balancer", short: "LB" },
  vpn: { label: "VPN Gateway", short: "VPN" },
  firewall: { label: "Azure Firewall", short: "Firewall" },
  ports: { label: "Portas TCP/UDP", short: "Portas" },
};

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; rank: string; blurb: string; eta: string }
> = {
  iniciante: {
    label: "Iniciante",
    rank: "L1",
    blurb: "VNet, subnet, NSG, IP publico e privado. Falhas de conectividade direta.",
    eta: "8-12 min",
  },
  n2: {
    label: "N2",
    rank: "L2",
    blurb: "UDR, peering, DNS privado e health probe de Load Balancer.",
    eta: "12-18 min",
  },
  n3: {
    label: "N3",
    rank: "L3",
    blurb: "Firewall, VPN site-to-site e roteamento assimetrico.",
    eta: "18-25 min",
  },
  cne: {
    label: "Cloud Network Engineer",
    rank: "CNE",
    blurb: "Hub-spoke, transitivity, outbound e desenho de trafego.",
    eta: "20-30 min",
  },
};

export function defaultNsgRules(): NsgRule[] {
  return [
    {
      name: "AllowVNetInBound",
      priority: 65000,
      direction: "Inbound",
      access: "Allow",
      protocol: "*",
      source: "VirtualNetwork",
      sourcePort: "*",
      dest: "VirtualNetwork",
      destPort: "*",
    },
    {
      name: "AllowAzureLoadBalancerInBound",
      priority: 65001,
      direction: "Inbound",
      access: "Allow",
      protocol: "*",
      source: "AzureLoadBalancer",
      sourcePort: "*",
      dest: "*",
      destPort: "*",
    },
    {
      name: "DenyAllInBound",
      priority: 65500,
      direction: "Inbound",
      access: "Deny",
      protocol: "*",
      source: "*",
      sourcePort: "*",
      dest: "*",
      destPort: "*",
    },
    {
      name: "AllowVnetOutBound",
      priority: 65000,
      direction: "Outbound",
      access: "Allow",
      protocol: "*",
      source: "VirtualNetwork",
      sourcePort: "*",
      dest: "VirtualNetwork",
      destPort: "*",
    },
    {
      name: "AllowInternetOutBound",
      priority: 65001,
      direction: "Outbound",
      access: "Allow",
      protocol: "*",
      source: "*",
      sourcePort: "*",
      dest: "Internet",
      destPort: "*",
    },
    {
      name: "DenyAllOutBound",
      priority: 65500,
      direction: "Outbound",
      access: "Deny",
      protocol: "*",
      source: "*",
      sourcePort: "*",
      dest: "*",
      destPort: "*",
    },
  ];
}
