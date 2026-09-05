import { defaultNsgRules, type Lab } from "../types";

const nsg = defaultNsgRules();

export const lab: Lab = {
    id: "udr-blackhole",
    code: "INC-2041",
    title: "VMs sem internet após endurecimento de rota",
    difficulty: "n2",
    technologies: ["route-table", "vnet", "subnet", "private-ip"],
    severity: "Sev2",
    etaMin: 14,
    ticket: {
      title: "Windows Update e apt-get falham em snet-app",
      reporter: "Diego Alves · Platform",
      service: "rg-app-prod / rt-app",
      openedAt: "2026-09-03T11:20:00-03:00",
      description:
        "Depois de um change para 'bloquear egresso direto', as VMs de snet-app não alcançam a internet. Ping entre VMs da subnet funciona. Não há NVA implantado ainda — o appliance está no backlog.",
      symptoms: [
        "ping 8.8.8.8 timeout / Destination unreachable",
        "ping 10.10.2.5 (vizinha) ok",
        "Nenhum Azure Firewall no resource group",
      ],
      impact: "Patch terça-feira quebrado. Imagens Docker não baixam.",
      lastChange: "Change CHG-4412: rota default em rt-app.",
    },
    topology: {
      nodes: [
        { id: "inet", kind: "internet", label: "Internet", x: 78, y: 12 },
        { id: "vnet", kind: "vnet", label: "vnet-app  10.10.0.0/16", x: 10, y: 28, w: 62, h: 60 },
        { id: "snet", kind: "subnet", label: "snet-app", sublabel: "10.10.2.0/24", x: 16, y: 42, w: 50, h: 38, parentId: "vnet" },
        { id: "rt", kind: "nsg", label: "rt-app  0.0.0.0/0 → None", x: 28, y: 50, status: "error", parentId: "snet" },
        { id: "vm1", kind: "vm", label: "vm-app-01", sublabel: "10.10.2.4", x: 28, y: 68, status: "warn", parentId: "snet" },
        { id: "vm2", kind: "vm", label: "vm-app-02", sublabel: "10.10.2.5", x: 52, y: 68, status: "ok", parentId: "snet" },
      ],
      edges: [
        { from: "vm1", to: "vm2", kind: "ok", label: "VnetLocal" },
        { from: "vm1", to: "inet", kind: "blocked", label: "0.0.0.0/0 None" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0004-4e11-9c01-udr",
      resourceGroup: "rg-app-prod",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-app",
          space: ["10.10.0.0/16"],
          subnets: [{ name: "snet-app", prefix: "10.10.2.0/24", routeTable: "rt-app" }],
        },
      ],
      nsgs: [{ name: "nsg-app", rules: [...nsg] }],
      routeTables: [
        {
          name: "rt-app",
          routes: [{ name: "default-blackhole", prefix: "0.0.0.0/0", nextHopType: "None" }],
        },
      ],
      vms: [
        {
          name: "vm-app-01",
          os: "linux",
          vnet: "vnet-app",
          subnet: "snet-app",
          privateIp: "10.10.2.4",
          nic: "nic-app-01",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
        {
          name: "vm-app-02",
          os: "linux",
          vnet: "vnet-app",
          subnet: "snet-app",
          privateIp: "10.10.2.5",
          nic: "nic-app-02",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [],
    },
    connectivity: [
      { from: "vm-app-01", to: "10.10.2.5", proto: "icmp", result: "ok" },
      { from: "vm-app-01", to: "8.8.8.8", proto: "icmp", result: "no-route", note: "UDR None" },
      { from: "vm-app-01", to: "1.1.1.1", proto: "tcp", port: 443, result: "no-route" },
      { from: "internet", to: "10.10.2.4", proto: "icmp", result: "no-route" },
    ],
    hypotheses: [
      { id: "a", label: "NSG DenyAllOutBound está ativo sem Allow Internet", correct: false },
      { id: "b", label: "DNS 168.63.129.16 caiu", correct: false },
      { id: "c", label: "UDR 0.0.0.0/0 next hop None descarta o egresso", correct: true },
      { id: "d", label: "As VMs não têm Public IP e por isso não saem", correct: false },
    ],
    hints: [
      "Conectividade leste-oeste ok e norte-sul quebrada aponta para rota default, não para NSG de subnet interna.",
      "Mostre a effective route table da NIC. Procure 0.0.0.0/0 e o nextHopType.",
      "rt-app tem default-blackhole com next hop None. Isso sobrescreve a rota sistema Internet.",
    ],
    debrief: {
      rootCause:
        "A UDR 0.0.0.0/0 com next hop None anula a rota sistema para Internet. Pacotes egressos são descartados. Tráfego VnetLocal não casa com 0.0.0.0/0 de forma preferencial ao prefixo mais específico da VNet, então o leste-oeste sobrevive.",
      solution:
        "Remova a rota ou aponte 0.0.0.0/0 para VirtualAppliance / Internet / NAT Gateway quando o NVA existir. Não use None como 'placeholder' de segurança.",
      commands: [
        "az network nic show-effective-route-table -g rg-app-prod --nic-name nic-app-01 -o table",
        "az network route-table route list -g rg-app-prod --route-table-name rt-app -o table",
        "az network route-table route delete -g rg-app-prod --route-table-name rt-app -n default-blackhole",
      ],
      conceptTitle: "UDR e next hop None",
      concept:
        "Rotas de usuário sobrescrevem rotas de sistema no mesmo prefixo. Next hop None é um blackhole explícito. Longest prefix match ainda escolhe 10.10.0.0/16 (VnetLocal) para tráfego interno.",
      prevention:
        "Nunca publique UDR default antes do NVA/Firewall estar healthy. Use rota de teste em uma subnet canário. Monitorar effective routes com alerta se nextHopType=None em 0.0.0.0/0.",
    },
  };
