import type { Lab } from "../types";

export const lab: Lab = {
    id: "peering-one-way",
    code: "INC-2119",
    title: "Spoke não alcança serviços do hub",
    difficulty: "n2",
    technologies: ["peering", "vnet", "private-ip"],
    severity: "Sev2",
    etaMin: 14,
    ticket: {
      title: "vm-spoke-web timeout para vm-hub-dns 10.0.1.8",
      reporter: "Priya Nair · Shared Services",
      service: "rg-hub / rg-spoke-web",
      openedAt: "2026-09-02T09:15:00-03:00",
      description:
        "Novo spoke vnet-spoke-web foi peerado com o hub. Do hub, o engenheiro vê a peering 'Initiated'. Do spoke, o estado aparece Connected. Resolução e ping para 10.0.1.8 falham.",
      symptoms: [
        "az network vnet peering list no spoke → Connected",
        "az network vnet peering list no hub → Initiated",
        "NSGs permitem VNetInBound",
      ],
      impact: "Spoke sem DNS compartilhado. Deploy de API parado.",
      lastChange: "Hoje 08:40: peering criado só no lado do spoke via Terraform parcial.",
    },
    topology: {
      nodes: [
        { id: "hub", kind: "vnet", label: "vnet-hub  10.0.0.0/16", x: 8, y: 28, w: 38, h: 52 },
        { id: "spoke", kind: "vnet", label: "vnet-spoke-web  10.1.0.0/16", x: 54, y: 28, w: 38, h: 52 },
        { id: "snet-h", kind: "subnet", label: "snet-shared", sublabel: "10.0.1.0/24", x: 14, y: 44, w: 26, h: 28, parentId: "hub" },
        { id: "snet-s", kind: "subnet", label: "snet-web", sublabel: "10.1.2.0/24", x: 60, y: 44, w: 26, h: 28, parentId: "spoke" },
        { id: "vmh", kind: "vm", label: "vm-hub-dns", sublabel: "10.0.1.8", x: 24, y: 60, status: "ok", parentId: "snet-h" },
        { id: "vms", kind: "vm", label: "vm-spoke-web", sublabel: "10.1.2.10", x: 70, y: 60, status: "error", parentId: "snet-s" },
      ],
      edges: [{ from: "vms", to: "vmh", kind: "blocked", label: "peering 1-way" }],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0005-4e11-9c01-peer",
      resourceGroup: "rg-spoke-web",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-hub",
          space: ["10.0.0.0/16"],
          subnets: [{ name: "snet-shared", prefix: "10.0.1.0/24" }],
        },
        {
          name: "vnet-spoke-web",
          space: ["10.1.0.0/16"],
          subnets: [{ name: "snet-web", prefix: "10.1.2.0/24" }],
        },
      ],
      nsgs: [],
      routeTables: [],
      vms: [
        {
          name: "vm-hub-dns",
          os: "linux",
          vnet: "vnet-hub",
          subnet: "snet-shared",
          privateIp: "10.0.1.8",
          nic: "nic-hub-dns",
          power: "VM running",
          size: "Standard_B2s",
        },
        {
          name: "vm-spoke-web",
          os: "linux",
          vnet: "vnet-spoke-web",
          subnet: "snet-web",
          privateIp: "10.1.2.10",
          nic: "nic-spoke-web",
          power: "VM running",
          size: "Standard_B2s",
        },
      ],
      peerings: [
        {
          name: "spoke-to-hub",
          vnet: "vnet-spoke-web",
          remote: "vnet-hub",
          allowForwarded: false,
          allowGateway: false,
          useRemoteGw: false,
          state: "Connected",
        },
        {
          name: "hub-to-spoke",
          vnet: "vnet-hub",
          remote: "vnet-spoke-web",
          allowForwarded: false,
          allowGateway: false,
          useRemoteGw: false,
          state: "Initiated",
        },
      ],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [],
    },
    connectivity: [
      { from: "vm-spoke-web", to: "10.0.1.8", proto: "icmp", result: "timeout", note: "peering não sincronizado" },
      { from: "vm-hub-dns", to: "10.1.2.10", proto: "icmp", result: "timeout" },
      { from: "vm-spoke-web", to: "10.1.2.10", proto: "icmp", result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "Peering não é transitivo e falta um terceiro spoke", correct: false },
      { id: "b", label: "O lado do hub permanece Initiated — peering incompleto", correct: true },
      { id: "c", label: "Overlap de address space 10.0.0.0/8", correct: false },
      { id: "d", label: "useRemoteGateways está true sem gateway", correct: false },
    ],
    hints: [
      "Peering é uma relação de dois lados. Connected de um lado só não programa rotas no outro.",
      "Liste peering em vnet-hub e em vnet-spoke-web. Compare peeringState.",
      "hub-to-spoke está Initiated. O link não sincronizou; effective routes do spoke não incluem 10.0.0.0/16.",
    ],
    debrief: {
      rootCause:
        "Terraform criou o peering apenas no spoke (Connected). O objeto no hub ficou Initiated, sem reciprocar. Sem os dois lados Connected, as rotas remotas não entram na effective route table.",
      solution:
        "Crie/confirme o peering recíproco no hub até ambos Connected. No Terraform, use dois recursos azurerm_virtual_network_peering (ou o recurso de ambos os lados).",
      commands: [
        "az network vnet peering list -g rg-hub --vnet-name vnet-hub -o table",
        "az network vnet peering list -g rg-spoke-web --vnet-name vnet-spoke-web -o table",
        "az network nic show-effective-route-table -g rg-spoke-web --nic-name nic-spoke-web -o table",
      ],
      conceptTitle: "Peering é bidirecional",
      concept:
        "Cada VNet precisa de um objeto de peering apontando para a outra. Estado Initiated significa que o remoto ainda não aceitou. Só Connected/Connected instala os prefixos remotos como VNetPeering.",
      prevention:
        "Pipeline deve falhar se peeringState != Connected nos dois lados. Teste smoke: ping de uma NIC de cada VNet após o apply.",
    },
  };
