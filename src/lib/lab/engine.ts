import type { Lab } from "./types";
import {
  findVm,
  flag,
  helpText,
  json,
  matchConn,
  notFound,
  pingOut,
  resolveTarget,
  table,
  tcpOut,
  tokenize,
  vmByIp,
  type CommandResult,
} from "./sim";
import { azNetwork } from "./az";

export function runCommand(
  raw: string,
  lab: Lab,
  context: string,
): CommandResult & { context?: string } {
  const line = raw.trim();
  if (!line) return { output: "" };
  const tokens = tokenize(line);
  const bin = tokens[0];
  const world = lab.world;

  if (bin === "help" || bin === "?") return { output: helpText() };
  if (bin === "clear") return { output: "__CLEAR__" };
  if (bin === "ticket") {
    const t = lab.ticket;
    return {
      output: `${lab.code}  ${t.title}\n${t.description}\n\nSintomas:\n${t.symptoms.map((s) => "  - " + s).join("\n")}\n\nImpacto: ${t.impact}`,
    };
  }
  if (bin === "whoami") {
    const vm = findVm(world, context);
    return {
      output: vm
        ? `contexto=${vm.name}  nic=${vm.nic}  private=${vm.privateIp}  public=${vm.publicIp ?? "-"}`
        : `contexto=internet (operador externo)`,
    };
  }
  if (bin === "use") {
    const name = tokens[1];
    if (!name || name === "internet") return { output: "contexto alterado para internet", context: "internet" };
    const vm = findVm(world, name);
    if (!vm) return { error: true, output: `VM/contexto '${name}' não existe. az vm list` };
    return { output: `contexto alterado para ${vm.name} (${vm.privateIp})`, context: vm.name };
  }

  if (bin === "az") {
    const group = tokens[1];
    if (!group) return { output: "az: missing command. Try 'help'." };
    if (group === "account" && tokens[2] === "show") {
      return {
        output: json({
          name: world.subscription,
          id: world.subscriptionId,
          state: "Enabled",
        }),
      };
    }
    if (group === "group" && tokens[2] === "show") {
      return {
        output: json({
          name: world.resourceGroup,
          location: world.location,
        }),
      };
    }
    if (group === "resource" && tokens[2] === "list") {
      const rows: string[][] = [];
      for (const v of world.vnets) rows.push([v.name, "Microsoft.Network/virtualNetworks", world.resourceGroup]);
      for (const n of world.nsgs) rows.push([n.name, "Microsoft.Network/networkSecurityGroups", world.resourceGroup]);
      for (const r of world.routeTables) rows.push([r.name, "Microsoft.Network/routeTables", world.resourceGroup]);
      for (const vm of world.vms) rows.push([vm.name, "Microsoft.Compute/virtualMachines", world.resourceGroup]);
      for (const p of world.publicIps) rows.push([p.name, "Microsoft.Network/publicIPAddresses", world.resourceGroup]);
      for (const l of world.lbs) rows.push([l.name, "Microsoft.Network/loadBalancers", world.resourceGroup]);
      for (const f of world.firewalls) rows.push([f.name, "Microsoft.Network/azureFirewalls", world.resourceGroup]);
      for (const v of world.vpns) rows.push([v.name, "Microsoft.Network/connections", world.resourceGroup]);
      for (const z of world.dnsZones) rows.push([z.name, "Microsoft.Network/privateDnsZones", world.resourceGroup]);
      return { output: table(["Name", "Type", "ResourceGroup"], rows) };
    }
    if (group === "vm" && (tokens[2] === "list" || tokens[2] === "list-ip-addresses" || !tokens[2])) {
      return {
        output: table(
          ["Name", "Power", "PrivateIp", "PublicIp", "Subnet", "NIC"],
          world.vms.map((v) => [v.name, v.power, v.privateIp, v.publicIp ?? "-", v.subnet, v.nic]),
        ),
      };
    }
    if (group === "vm" && tokens[2] === "show") {
      const name = flag(tokens, ["-n", "--name"]) ?? tokens[3];
      const vm = findVm(world, name ?? "");
      if (!vm) return notFound("vm", name ?? "");
      return { output: json(vm) };
    }
    if (group === "network") return azNetwork(tokens, lab);
    return { error: true, output: `az ${group}: não suportado neste lab. help` };
  }

  if (bin === "ping") {
    const target = tokens[1];
    if (!target) return { error: true, output: "usage: ping <alvo>" };
    const host = resolveTarget(world, target);
    const conn =
      matchConn(lab.connectivity, context, target, "icmp") ??
      matchConn(lab.connectivity, context, host, "icmp");
    return pingOut(host, conn);
  }

  if (bin === "traceroute" || bin === "tracert") {
    const target = tokens[1];
    if (!target) return { error: true, output: "usage: traceroute <alvo>" };
    const host = resolveTarget(world, target);
    const conn =
      matchConn(lab.connectivity, context, target, "icmp") ??
      matchConn(lab.connectivity, context, host, "icmp") ??
      matchConn(lab.connectivity, context, host, "tcp");
    if (!conn || conn.result === "no-route") {
      return {
        error: true,
        output: `traceroute to ${host}\n 1  * * *\n 2  * * *\n(no route)`,
      };
    }
    if (conn.result !== "ok") {
      const hop =
        lab.world.firewalls[0]?.privateIp ??
        lab.world.vms.find((v) => v.name.includes("nva"))?.privateIp ??
        "*";
      return {
        output: `traceroute to ${host}, 8 hops max\n 1  10.0.0.1  1.1 ms\n 2  ${hop}  2.4 ms\n 3  * * *\n 4  * * *`,
      };
    }
    return { output: `traceroute to ${host}\n 1  gateway  0.8 ms\n 2  ${host}  1.6 ms` };
  }

  if (bin === "nslookup" || bin === "dig") {
    const name = tokens[1];
    if (!name) return { error: true, output: "usage: nslookup <nome>" };
    const conn = matchConn(lab.connectivity, context, name, "dns");
    const zone = world.dnsZones.find((z) => name.endsWith(z.name) || name.includes(z.name.split(".")[0]));
    const rec = zone?.records.find((r) => name.startsWith(r.name) || name.includes(r.name));
    if (conn?.result === "nxdomain") {
      return { error: true, output: `** server can't find ${name}: NXDOMAIN` };
    }
    if (conn?.note?.includes("público") || conn?.note?.includes("public")) {
      return {
        output: `Server:\t168.63.129.16\nAddress:\t168.63.129.16#53\n\nNon-authoritative answer:\nName:\t${name}\nAddress: 40.78.12.44`,
      };
    }
    if (rec && zone && zone.links.length) {
      return {
        output: `Server:\t168.63.129.16\nName:\t${rec.name}.${zone.name}\nAddress: ${rec.value}`,
      };
    }
    if (rec && zone && !zone.links.length) {
      return {
        output: `Server:\t168.63.129.16\nNon-authoritative answer:\nName:\t${name}\nAddress: 40.78.12.44\n\n; zona privada ${zone.name} existe, mas não está linked a esta VNet`,
      };
    }
    if (conn?.result === "ok") {
      return { output: `Server:\t168.63.129.16\nName:\t${name}\nAddress: 40.78.12.44` };
    }
    const vm = vmByIp(world, name) ?? findVm(world, name);
    if (vm) return { output: `Name:\t${vm.name}\nAddress: ${vm.privateIp}` };
    return { error: true, output: `** server can't find ${name}: NXDOMAIN` };
  }

  if (bin === "curl") {
    const url = tokens.find((t) => t.startsWith("http") || t.includes(".")) ?? tokens[tokens.length - 1];
    if (!url) return { error: true, output: "usage: curl [-I] <url>" };
    const host = resolveTarget(world, url);
    const port = url.startsWith("https") ? 443 : url.includes(":80") ? 80 : url.startsWith("http") ? 80 : 443;
    const explicit = /:(\d+)/.exec(url.split("/")[2] ?? "");
    const p = explicit ? Number(explicit[1]) : port;
    const conn =
      matchConn(lab.connectivity, context, url, "tcp", p) ??
      matchConn(lab.connectivity, context, host, "tcp", p);
    if (!conn || conn.result === "timeout") {
      return { error: true, output: `curl: (28) Connection timed out after 8000 ms to ${host} port ${p}` };
    }
    if (conn.result === "reject") {
      return { error: true, output: `curl: (7) Failed to connect to ${host} port ${p}: Connection refused` };
    }
    if (conn.result === "no-route") {
      return { error: true, output: `curl: (7) Failed to connect to ${host}: Network is unreachable` };
    }
    return { output: `HTTP/1.1 200 OK\nserver: nginx\ncontent-type: text/html` };
  }

  if (bin === "tnc" || bin === "Test-NetConnection") {
    const hostTok = tokens[1];
    if (!hostTok) return { error: true, output: "usage: tnc <host> -Port n" };
    const port = Number(flag(tokens, ["-Port", "-port", "--port"]) ?? "443");
    const host = resolveTarget(world, hostTok);
    const conn =
      matchConn(lab.connectivity, context, hostTok, "tcp", port) ??
      matchConn(lab.connectivity, context, host, "tcp", port);
    return tcpOut(host, port, conn);
  }

  if (bin === "ssh") {
    const dest = (tokens[1] ?? "").split("@").pop() ?? "";
    const host = resolveTarget(world, dest);
    const conn =
      matchConn(lab.connectivity, context, dest, "tcp", 22) ??
      matchConn(lab.connectivity, context, host, "tcp", 22);
    if (!conn || conn.result !== "ok") {
      return { error: true, output: `ssh: connect to host ${host} port 22: Connection timed out` };
    }
    return { output: `ssh: sessão recusada neste simulador (conectividade TCP/22 OK).` };
  }

  return {
    error: true,
    output: `${bin}: comando não encontrado. Digite help para a lista suportada.`,
  };
}
