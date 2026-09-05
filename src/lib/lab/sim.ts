import type { Connectivity, Lab, LabWorld, NsgRule, Route } from "./types";

export interface CommandResult {
  output: string;
  error?: boolean;
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

export function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return "(nenhum resultado)";
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = headers.map((h, i) => pad(h, widths[i])).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const body = rows.map((r) => r.map((c, i) => pad(c ?? "", widths[i])).join("  ")).join("\n");
  return `${line}\n${sep}\n${body}`;
}

export function tokenize(raw: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: '"' | "'" | null = null;
  for (const ch of raw.trim()) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function flag(tokens: string[], names: string[]): string | undefined {
  for (let i = 0; i < tokens.length; i++) {
    if (names.includes(tokens[i]) && tokens[i + 1] && !tokens[i + 1].startsWith("-")) {
      return tokens[i + 1];
    }
    for (const n of names) {
      if (tokens[i].startsWith(`${n}=`)) return tokens[i].slice(n.length + 1);
    }
  }
  return undefined;
}

export function json(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function notFound(kind: string, name: string): CommandResult {
  return {
    error: true,
    output: `ERROR: ${kind} '${name}' not found in the current lab scope.`,
  };
}

export function helpText(): string {
  return `Cloud Network Lab Coach — terminal simulado
Contexto define a origem de ping/curl/tnc. Comandos disponíveis:

  help                         esta lista
  clear                        limpa a tela
  ticket                       reimprime o incidente
  use <vm|internet>            muda a origem dos testes
  whoami                       mostra o contexto atual

  az account show
  az group show
  az resource list -o table
  az vm list | show -n <nome>
  az network vnet list | show -n <nome>
  az network vnet subnet list --vnet-name <nome>
  az network nsg list | show -n <nome>
  az network nsg rule list --nsg-name <nome>
  az network route-table list
  az network route-table route list --route-table-name <nome>
  az network vnet peering list --vnet-name <nome>
  az network public-ip list
  az network nic show -n <nome>
  az network nic show-effective-route-table --nic-name <nome>
  az network nic list-effective-nsg --nic-name <nome>
  az network lb list | show -n <nome>
  az network lb probe list --lb-name <nome>
  az network lb rule list --lb-name <nome>
  az network lb outbound-rule list --lb-name <nome>
  az network vpn-connection list | show -n <nome>
  az network firewall list
  az network firewall network-rule list --firewall-name <nome>
  az network firewall application-rule list --firewall-name <nome>
  az network private-dns zone list
  az network private-dns link vnet list -z <zona>
  az network private-dns record-set list -z <zona>

  ping <alvo>
  traceroute <alvo>
  nslookup <nome>
  curl [-I] <url>
  tnc <host> [-Port n]
  Test-NetConnection <host> -Port n`;
}

export function findVm(world: LabWorld, name: string) {
  return world.vms.find((v) => v.name === name || v.nic === name);
}

export function vmByIp(world: LabWorld, ip: string) {
  return world.vms.find((v) => v.privateIp === ip || v.publicIp === ip);
}

export function resolveTarget(world: LabWorld, target: string): string {
  const vm = findVm(world, target);
  if (vm) return vm.publicIp ?? vm.privateIp;
  return target.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
}

export function matchConn(
  list: Connectivity[],
  from: string,
  to: string,
  proto: Connectivity["proto"],
  port?: number,
): Connectivity | undefined {
  const toHost = to.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return list.find((c) => {
    if (c.from !== from && !(from === "internet" && c.from === "internet")) return false;
    if (c.proto !== proto) return false;
    if (port != null && c.port != null && c.port !== port) return false;
    if (port != null && c.port == null && proto !== "icmp" && proto !== "dns") return false;
    const ct = c.to;
    return ct === to || ct === toHost || ct === to.replace(/:\d+$/, "");
  });
}

export function effectiveRoutes(lab: Lab, vmName: string): Route[] {
  const vm = findVm(lab.world, vmName);
  if (!vm) return [];
  const vnet = lab.world.vnets.find((v) => v.name === vm.vnet);
  const subnet = vnet?.subnets.find((s) => s.name === vm.subnet);
  const udr = lab.world.routeTables.find((r) => r.name === subnet?.routeTable);
  const routes: Route[] = [];
  for (const space of vnet?.space ?? []) {
    routes.push({ name: "VnetLocal", prefix: space, nextHopType: "VnetLocal" });
  }
  for (const p of lab.world.peerings.filter((x) => x.vnet === vm.vnet && x.state === "Connected")) {
    const remote = lab.world.vnets.find((v) => v.name === p.remote);
    for (const space of remote?.space ?? []) {
      routes.push({ name: `Peering-${p.remote}`, prefix: space, nextHopType: "VNetPeering" });
    }
  }
  for (const vpn of lab.world.vpns) {
    if (vpn.overlap) continue;
    for (const pfx of vpn.remotePrefixes) {
      routes.push({ name: vpn.name, prefix: pfx, nextHopType: "VirtualNetworkGateway" });
    }
  }
  if (udr) {
    for (const r of udr.routes) routes.push({ ...r });
  } else {
    routes.push({ name: "Internet", prefix: "0.0.0.0/0", nextHopType: "Internet" });
  }
  return routes;
}

export function pingOut(target: string, conn?: Connectivity): CommandResult {
  if (!conn || conn.result === "nxdomain") {
    return { error: true, output: `ping: ${target}: Name or service not known` };
  }
  if (conn.result === "no-route") {
    return {
      error: true,
      output: `PING ${target} (${target}): 56 data bytes\nFrom local: Destination Host Unreachable\n--- ${target} ping statistics ---\n3 packets transmitted, 0 received, 100% packet loss`,
    };
  }
  if (conn.result === "timeout" || conn.result === "reject") {
    return {
      error: true,
      output: `PING ${target} (${target}): 56 data bytes\nRequest timeout for icmp_seq 0\nRequest timeout for icmp_seq 1\nRequest timeout for icmp_seq 2\n--- ${target} ping statistics ---\n3 packets transmitted, 0 received, 100% packet loss`,
    };
  }
  return {
    output: `PING ${target} (${target}): 56 data bytes\n64 bytes from ${target}: icmp_seq=0 ttl=64 time=1.4 ms\n64 bytes from ${target}: icmp_seq=1 ttl=64 time=1.1 ms\n64 bytes from ${target}: icmp_seq=2 ttl=64 time=1.3 ms\n--- ${target} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss`,
  };
}

export function tcpOut(host: string, port: number, conn?: Connectivity): CommandResult {
  if (!conn || conn.result === "timeout") {
    return {
      error: true,
      output: `TcpTestSucceeded : False\nRemoteAddress    : ${host}\nRemotePort       : ${port}\nInterfaceAlias   : eth0\nPingSucceeded    : False\n\n(timeout — nenhum SYN-ACK)`,
    };
  }
  if (conn.result === "no-route") {
    return {
      error: true,
      output: `TcpTestSucceeded : False\nRemoteAddress    : ${host}\nRemotePort       : ${port}\n\nNetwork is unreachable`,
    };
  }
  if (conn.result === "reject") {
    return {
      error: true,
      output: `TcpTestSucceeded : False\nRemoteAddress    : ${host}\nRemotePort       : ${port}\n\nConnection refused`,
    };
  }
  return {
    output: `TcpTestSucceeded : True\nRemoteAddress    : ${host}\nRemotePort       : ${port}\nPingSucceeded    : True`,
  };
}
