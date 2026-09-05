import type { Lab } from "../types";

export const lab: Lab = {
    id: "asymmetric-udr",
    code: "INC-3088",
    title: "Tráfego hub → spoke chega e a resposta some",
    difficulty: "n3",
    technologies: ["route-table", "peering", "vnet", "firewall"],
    severity: "Sev2",
    etaMin: 20,
    ticket: {
      title: "SYN chega em vm-spoke-api, ACK nunca volta",
      reporter: "Network Watcher · capture",
      service: "rg-hub / rg-spoke-api",
      openedAt: "2026-08-30T10:11:00-03:00",
      description:
        "Do jumpbox do hub (10.0.2.10) o HTTPS para vm-spoke-api (10.10.1.5:443) estoura timeout. Capture no spoke mostra SYN chegando. Capture no hub não vê o ACK. Spoke tem UDR 10.0.0.0/8 via NVA 10.0.1.4. NVA não faz SNAT.",
      symptoms: [
        "Packet capture spoke: SYN in, SYN-ACK out na NIC",
        "Packet capture hub: só SYN out, sem SYN-ACK",
        "Peering Connected com allowForwardedTraffic=true nos dois lados",
      ],
      impact: "Shared services do hub não consomem a API do spoke.",
      lastChange: "UDR ampla 10.0.0.0/8 aplicada no spoke para forçar inspeção.",
    },
    topology: {
      nodes: [
        { id: "hub", kind: "vnet", label: "vnet-hub  10.0.0.0/16", x: 6, y: 20, w: 40, h: 64 },
        { id: "spoke", kind: "vnet", label: "vnet-spoke-api  10.10.0.0/16", x: 54, y: 20, w: 40, h: 64 },
        { id: "nva", kind: "nva", label: "nva-inspect", sublabel: "10.0.1.4", x: 22, y: 36, status: "warn", parentId: "hub" },
        { id: "vmh", kind: "vm", label: "vm-hub-jump", sublabel: "10.0.2.10", x: 22, y: 66, status: "ok", parentId: "hub" },
        { id: "vms", kind: "vm", label: "vm-spoke-api", sublabel: "10.10.1.5", x: 74, y: 52, status: "error", parentId: "spoke" },
      ],
      edges: [
        { from: "vmh", to: "vms", kind: "ok", label: "ida (peering)" },
        { from: "vms", to: "nva", kind: "blocked", label: "volta UDR /8" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0008-4e11-9c01-asym",
      resourceGroup: "rg-spoke-api",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-hub",
          space: ["10.0.0.0/16"],
          subnets: [
            { name: "snet-nva", prefix: "10.0.1.0/24" },
            { name: "snet-jump", prefix: "10.0.2.0/24" },
          ],
        },
        {
          name: "vnet-spoke-api",
          space: ["10.10.0.0/16"],
          subnets: [{ name: "snet-api", prefix: "10.10.1.0/24", routeTable: "rt-spoke" }],
        },
      ],
      nsgs: [],
      routeTables: [
        {
          name: "rt-spoke",
          routes: [{ name: "to-nva-rfc1918", prefix: "10.0.0.0/8", nextHopType: "VirtualAppliance", nextHopIp: "10.0.1.4" }],
        },
      ],
      vms: [
        {
          name: "vm-hub-jump",
          os: "linux",
          vnet: "vnet-hub",
          subnet: "snet-jump",
          privateIp: "10.0.2.10",
          nic: "nic-hub-jump",
          power: "VM running",
          size: "Standard_B2s",
        },
        {
          name: "nva-inspect",
          os: "linux",
          vnet: "vnet-hub",
          subnet: "snet-nva",
          privateIp: "10.0.1.4",
          nic: "nic-nva",
          power: "VM running",
          size: "Standard_D4s_v5",
        },
        {
          name: "vm-spoke-api",
          os: "linux",
          vnet: "vnet-spoke-api",
          subnet: "snet-api",
          privateIp: "10.10.1.5",
          nic: "nic-spoke-api",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [
        {
          name: "hub-to-spoke",
          vnet: "vnet-hub",
          remote: "vnet-spoke-api",
          allowForwarded: true,
          allowGateway: false,
          useRemoteGw: false,
          state: "Connected",
        },
        {
          name: "spoke-to-hub",
          vnet: "vnet-spoke-api",
          remote: "vnet-hub",
          allowForwarded: true,
          allowGateway: false,
          useRemoteGw: false,
          state: "Connected",
        },
      ],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [],
    },
    connectivity: [
      { from: "vm-hub-jump", to: "10.10.1.5", proto: "tcp", port: 443, result: "timeout", note: "assimétrico" },
      { from: "vm-spoke-api", to: "10.0.2.10", proto: "icmp", result: "timeout" },
      { from: "vm-spoke-api", to: "10.0.1.4", proto: "icmp", result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "Peering sem allowForwardedTraffic", correct: false },
      { id: "b", label: "NSG no spoke dropa o SYN", correct: false },
      { id: "c", label: "UDR 10.0.0.0/8 no spoke assimetriza o retorno via NVA sem SNAT", correct: true },
      { id: "d", label: "IP 10.10.1.5 está em subnet errada", correct: false },
    ],
    hints: [
      "Se o SYN chega e o SYN-ACK sai da NIC de destino, o problema não é NSG inbound. Olhe o caminho de volta.",
      "Effective routes de nic-spoke-api: o prefixo do hub está coberto por 10.0.0.0/8 via VirtualAppliance.",
      "Ida usa VNetPeering (mais específico no hub). Volta usa UDR /8 via NVA. Sem SNAT, o estado não casa e o pacote morre.",
    ],
    debrief: {
      rootCause:
        "Roteamento assimétrico. Ida hub→spoke segue peering. Volta casa com UDR 10.0.0.0/8 e vai ao NVA, que não tem estado nem SNAT. O SYN-ACK nunca retorna ao jumpbox.",
      solution:
        "Troque 10.0.0.0/8 por rotas específicas (ex.: 0.0.0.0/0 via NVA) e deixe 10.0.0.0/16 pelo peering; ou habilite SNAT no NVA; ou publique UDR simétrica no hub também.",
      commands: [
        "az network nic show-effective-route-table -g rg-spoke-api --nic-name nic-spoke-api -o table",
        "az network nic show-effective-route-table -g rg-hub --nic-name nic-hub-jump -o table",
        "az network route-table route list -g rg-spoke-api --route-table-name rt-spoke -o table",
      ],
      conceptTitle: "Assimetria e stateful inspection",
      concept:
        "Firewalls/NVAs são stateful. Caminhos ida/volta diferentes quebram a sessão. UDR superagregada (10.0.0.0/8) frequentemente 'engole' prefixos de hub que deveriam permanecer VNetPeering.",
      prevention:
        "Desenhe rotas simétricas. Evite RFC1918 agregado apontando para NVA quando o hub vive dentro desse agregado. Documente o path em diagrama antes do change.",
    },
  };
