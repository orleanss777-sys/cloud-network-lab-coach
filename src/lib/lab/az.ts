import type { Lab, NsgRule } from "./types";
import {
  effectiveRoutes,
  findVm,
  flag,
  json,
  notFound,
  table,
  type CommandResult,
} from "./sim";

export function azNetwork(tokens: string[], lab: Lab): CommandResult {
  const world = lab.world;
  const sub = tokens.slice(2);
  const resource = sub[0];
  const action = sub[1];

  if (resource === "vnet" && (action === "list" || !action)) {
    return {
      output: table(
        ["Name", "AddressSpace", "Subnets", "Location"],
        world.vnets.map((v) => [v.name, v.space.join(","), String(v.subnets.length), world.location]),
      ),
    };
  }
  if (resource === "vnet" && action === "show") {
    const name = flag(tokens, ["-n", "--name"]) ?? sub[2];
    const v = world.vnets.find((x) => x.name === name);
    if (!v) return notFound("vnet", name ?? "");
    return { output: json(v) };
  }
  if (resource === "vnet" && action === "subnet") {
    const vname = flag(tokens, ["--vnet-name", "-n"]) ?? "";
    const v = world.vnets.find((x) => x.name === vname) ?? world.vnets[0];
    if (!v) return notFound("vnet", vname);
    return {
      output: table(
        ["Name", "Prefix", "NSG", "RouteTable"],
        v.subnets.map((s) => [s.name, s.prefix, s.nsg ?? "-", s.routeTable ?? "-"]),
      ),
    };
  }
  if (resource === "vnet" && action === "peering") {
    const vname = flag(tokens, ["--vnet-name"]) ?? "";
    const rows = world.peerings
      .filter((p) => !vname || p.vnet === vname)
      .map((p) => [
        p.name,
        p.vnet,
        p.remote,
        p.state,
        String(p.allowForwarded),
        String(p.allowGateway),
        String(p.useRemoteGw),
      ]);
    return {
      output: table(
        ["Name", "VNet", "Remote", "State", "AllowForwarded", "AllowGwTransit", "UseRemoteGw"],
        rows,
      ),
    };
  }
  if (resource === "nsg" && action === "rule") {
    const nsgName = flag(tokens, ["--nsg-name", "-n"]) ?? "";
    const nsg = world.nsgs.find((n) => n.name === nsgName) ?? world.nsgs[0];
    if (!nsg) return notFound("nsg", nsgName);
    const rules = [...nsg.rules].sort((a, b) => a.priority - b.priority);
    return {
      output: table(
        ["Pri", "Name", "Dir", "Access", "Proto", "Source", "Dest", "Port"],
        rules.map((r: NsgRule) => [
          String(r.priority),
          r.name,
          r.direction,
          r.access,
          r.protocol,
          r.source,
          r.dest,
          r.destPort,
        ]),
      ),
    };
  }
  if (resource === "nsg" && (action === "list" || !action)) {
    return {
      output: table(
        ["Name", "Rules", "ResourceGroup"],
        world.nsgs.map((n) => [n.name, String(n.rules.length), world.resourceGroup]),
      ),
    };
  }
  if (resource === "nsg" && action === "show") {
    const name = flag(tokens, ["-n", "--name"]) ?? sub[2];
    const nsg = world.nsgs.find((n) => n.name === name);
    if (!nsg) return notFound("nsg", name ?? "");
    return { output: json(nsg) };
  }
  if (resource === "route-table" && action === "route") {
    const rtName = flag(tokens, ["--route-table-name", "-n"]) ?? "";
    const rt = world.routeTables.find((r) => r.name === rtName) ?? world.routeTables[0];
    if (!rt) return notFound("route-table", rtName);
    return {
      output: table(
        ["Name", "Prefix", "NextHopType", "NextHopIp"],
        rt.routes.map((r) => [r.name, r.prefix, r.nextHopType, r.nextHopIp ?? ""]),
      ),
    };
  }
  if (resource === "route-table" && (action === "list" || !action)) {
    return {
      output: table(
        ["Name", "Routes", "DisableBgp"],
        world.routeTables.map((r) => [r.name, String(r.routes.length), String(!!r.disableBgp)]),
      ),
    };
  }
  if (resource === "public-ip" && (action === "list" || !action)) {
    return {
      output: table(
        ["Name", "IP", "SKU", "AttachedTo"],
        world.publicIps.map((p) => [p.name, p.ip, p.sku, p.attachedTo ?? "-"]),
      ),
    };
  }
  if (resource === "nic" && action === "show-effective-route-table") {
    const nic = flag(tokens, ["--nic-name", "-n", "--name"]) ?? "";
    const vm = findVm(world, nic) ?? world.vms.find((v) => v.nic === nic);
    if (!vm) return notFound("nic", nic);
    const routes = effectiveRoutes(lab, vm.name);
    return {
      output: table(
        ["Name", "Prefix", "NextHopType", "NextHopIp", "Source"],
        routes.map((r) => [
          r.name,
          r.prefix,
          r.nextHopType,
          r.nextHopIp ?? "",
          r.nextHopType === "VirtualAppliance" || r.nextHopType === "None" ? "User" : "Default",
        ]),
      ),
    };
  }
  if (resource === "nic" && action === "list-effective-nsg") {
    const nic = flag(tokens, ["--nic-name", "-n", "--name"]) ?? "";
    const vm = findVm(world, nic) ?? world.vms.find((v) => v.nic === nic);
    if (!vm) return notFound("nic", nic);
    const nsg = world.nsgs.find((n) => n.name === vm.nsg);
    if (!nsg) return { output: `Nenhuma NSG efetiva em ${vm.nic}` };
    return {
      output:
        `Effective inbound rules on ${vm.nic} (NSG ${nsg.name})\n` +
        `Azure aplica NIC NSG AND subnet NSG — ambos precisam Allow.\n\n` +
        table(
          ["Pri", "Name", "Dir", "Access", "Proto", "Port"],
          [...nsg.rules]
            .sort((a, b) => a.priority - b.priority)
            .map((r) => [String(r.priority), r.name, r.direction, r.access, r.protocol, r.destPort]),
        ),
    };
  }
  if (resource === "nic" && action === "show") {
    const name = flag(tokens, ["-n", "--name"]) ?? sub[2];
    const vm = findVm(world, name ?? "") ?? world.vms.find((v) => v.nic === name);
    if (!vm) return notFound("nic", name ?? "");
    return {
      output: json({
        name: vm.nic,
        vnet: vm.vnet,
        subnet: vm.subnet,
        nsg: vm.nsg ?? null,
        ipConfigurations: [
          {
            privateIPAddress: vm.privateIp,
            publicIPAddress: vm.publicIp ?? null,
          },
        ],
      }),
    };
  }
  if (resource === "lb") {
    const lbName = flag(tokens, ["--lb-name", "-n", "--name"]);
    const lb = world.lbs.find((l) => l.name === lbName) ?? world.lbs[0];
    if (action === "list" || !action) {
      return {
        output: table(
          ["Name", "SKU", "Frontend", "Healthy", "OutboundRules"],
          world.lbs.map((l) => [
            l.name,
            l.sku,
            l.frontend,
            `${l.backends.filter((b) => b.healthy).length}/${l.backends.length}`,
            String(l.outboundRules.length),
          ]),
        ),
      };
    }
    if (!lb) return notFound("lb", lbName ?? "");
    if (action === "show") return { output: json(lb) };
    if (action === "probe") {
      return {
        output: table(
          ["Name", "Protocol", "Port", "Path"],
          lb.probes.map((p) => [p.name, p.proto, String(p.port), p.path ?? "-"]),
        ),
      };
    }
    if (action === "rule" || (action === "address-pool" && false)) {
      return {
        output: table(
          ["Name", "Frontend", "Backend", "Proto", "Probe"],
          lb.rules.map((r) => [r.name, String(r.frontendPort), String(r.backendPort), r.proto, r.probe]),
        ),
      };
    }
    if (action === "outbound-rule") {
      return {
        output:
          lb.outboundRules.length === 0
            ? "[]"
            : table(["Name"], lb.outboundRules.map((n) => [n])),
      };
    }
  }
  if (resource === "vpn-connection") {
    if (action === "list" || !action) {
      return {
        output: table(
          ["Name", "Status", "Gateway", "Local", "Remote", "Overlap"],
          world.vpns.map((v) => [
            v.name,
            v.status,
            v.gateway,
            v.localPrefixes.join(","),
            v.remotePrefixes.join(","),
            v.overlap ? "true" : "false",
          ]),
        ),
      };
    }
    const name = flag(tokens, ["-n", "--name"]) ?? sub[2];
    const vpn = world.vpns.find((v) => v.name === name) ?? world.vpns[0];
    if (!vpn) return notFound("vpn-connection", name ?? "");
    return { output: json(vpn) };
  }
  if (resource === "firewall") {
    if (action === "list" || !action) {
      return {
        output: table(
          ["Name", "PrivateIp", "Policy"],
          world.firewalls.map((f) => [f.name, f.privateIp, f.policy]),
        ),
      };
    }
    const fwName = flag(tokens, ["--firewall-name", "-n", "--name"]);
    const fw = world.firewalls.find((f) => f.name === fwName) ?? world.firewalls[0];
    if (!fw) return notFound("firewall", fwName ?? "");
    if (action === "network-rule") {
      return {
        output: table(
          ["Name", "Source", "Dest", "Ports", "Proto", "Action"],
          fw.networkRules.map((r) => [r.name, r.source, r.dest, r.ports, r.proto, r.action]),
        ),
      };
    }
    if (action === "application-rule") {
      if (!fw.appRules.length) return { output: "(nenhuma application rule)" };
      return {
        output: table(
          ["Name", "Source", "FQDN", "Protocols"],
          fw.appRules.map((r) => [r.name, r.source, r.fqdn, r.protocols]),
        ),
      };
    }
    if (action === "show") return { output: json(fw) };
  }
  if (resource === "private-dns") {
    const zoneName = flag(tokens, ["-z", "--zone-name"]) ?? sub[3];
    if (action === "zone") {
      return {
        output: table(
          ["Name", "Records", "Links"],
          world.dnsZones.map((z) => [z.name, String(z.records.length), String(z.links.length)]),
        ),
      };
    }
    const zone = world.dnsZones.find((z) => z.name === zoneName) ?? world.dnsZones[0];
    if (!zone) return notFound("private-dns zone", zoneName ?? "");
    if (action === "link") {
      return {
        output: zone.links.length
          ? table(
              ["Name", "VNet"],
              zone.links.map((l) => [l.name, l.vnet]),
            )
          : "(nenhum virtual network link)",
      };
    }
    if (action === "record-set") {
      return {
        output: table(
          ["Name", "Type", "Value"],
          zone.records.map((r) => [r.name, r.type, r.value]),
        ),
      };
    }
  }
  return {
    error: true,
    output: `az network: comando não reconhecido. Digite help.`,
  };
}
