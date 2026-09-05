import { defaultNsgRules, type Lab } from "../types";

const nsg = defaultNsgRules();

export const lab: Lab = {
    id: "missing-public-ip",
    code: "INC-1088",
    title: "RDP da internet para VM financeira",
    difficulty: "iniciante",
    technologies: ["public-ip", "private-ip", "vnet", "subnet", "nsg"],
    severity: "Sev3",
    etaMin: 8,
    ticket: {
      title: "Financeiro não acessa vm-finance via RDP",
      reporter: "Carlos Mota · FinOps",
      service: "rg-finance / vm-finance",
      openedAt: "2026-09-04T16:40:00-03:00",
      description:
        "Após migração para Standard SKU, o analista tenta RDP para 10.20.2.14 a partir de casa. O cliente RDP retorna 'não foi possível conectar'. NSG foi revisado e permite 3389 de Internet.",
      symptoms: [
        "mstsc 10.20.2.14:3389 falha imediatamente",
        "NSG nsg-finance Allow-RDP-Internet pri 200",
        "Existe um Public IP pip-finance-old no resource group",
      ],
      impact: "Fechamento mensal atrasado. Sem acesso administrativo à VM.",
      lastChange: "Ontem: SKU da NIC alterado para Standard; Public IP desassociado.",
    },
    topology: {
      nodes: [
        { id: "inet", kind: "internet", label: "Internet", x: 50, y: 8 },
        { id: "pip", kind: "pip", label: "pip-finance-old", sublabel: "não associado", x: 78, y: 22, status: "warn" },
        { id: "vnet", kind: "vnet", label: "vnet-finance  10.20.0.0/16", x: 16, y: 34, w: 58, h: 54 },
        { id: "snet", kind: "subnet", label: "snet-app", sublabel: "10.20.2.0/24", x: 24, y: 48, w: 42, h: 32, parentId: "vnet" },
        { id: "vm", kind: "vm", label: "vm-finance", sublabel: "10.20.2.14", x: 42, y: 64, status: "error", parentId: "snet" },
      ],
      edges: [
        { from: "inet", to: "vm", kind: "blocked", label: "RDP 3389" },
        { from: "pip", to: "vm", kind: "dashed", label: "desassociado" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0002-4e11-9c01-finance",
      resourceGroup: "rg-finance",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-finance",
          space: ["10.20.0.0/16"],
          subnets: [{ name: "snet-app", prefix: "10.20.2.0/24", nsg: "nsg-finance" }],
        },
      ],
      nsgs: [
        {
          name: "nsg-finance",
          rules: [
            {
              name: "Allow-RDP-Internet",
              priority: 200,
              direction: "Inbound",
              access: "Allow",
              protocol: "Tcp",
              source: "Internet",
              sourcePort: "*",
              dest: "*",
              destPort: "3389",
            },
            ...nsg,
          ],
        },
      ],
      routeTables: [],
      vms: [
        {
          name: "vm-finance",
          os: "windows",
          vnet: "vnet-finance",
          subnet: "snet-app",
          privateIp: "10.20.2.14",
          nsg: "nsg-finance",
          nic: "nic-finance",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [{ name: "pip-finance-old", ip: "13.88.21.40", sku: "Standard" }],
    },
    connectivity: [
      { from: "internet", to: "10.20.2.14", proto: "tcp", port: 3389, result: "no-route", note: "RFC1918 não roteável da internet" },
      { from: "internet", to: "13.88.21.40", proto: "tcp", port: 3389, result: "timeout", note: "PIP não associado" },
      { from: "vm-finance", to: "8.8.8.8", proto: "icmp", result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "NSG está bloqueando RDP da Internet", correct: false },
      { id: "b", label: "A VM não tem Public IP associado; 10.20.2.14 não é alcançável da internet", correct: true },
      { id: "c", label: "Peering ausente com a VNet de borda", correct: false },
      { id: "d", label: "Windows Firewall local recusa 3389", correct: false },
    ],
    hints: [
      "Endereços 10.0.0.0/8 não são roteáveis na internet pública. O cliente RDP precisa de um destino público ou de um hop (Bastion/VPN).",
      "Liste os Public IPs do resource group e veja a coluna de associação da NIC.",
      "pip-finance-old existe, mas attachedTo está vazio. A NIC nic-finance só tem IP privado.",
    ],
    debrief: {
      rootCause:
        "vm-finance possui apenas IP privado 10.20.2.14. O Public IP pip-finance-old está no grupo, sem associação. NSG permite 3389, mas o pacote da internet nunca chega à NIC.",
      solution:
        "Associe um Standard Public IP à NIC, ou — preferível — publique Bastion / VPN / AVD. Não exponha RDP na internet.",
      commands: [
        "az vm list-ip-addresses -g rg-finance -n vm-finance -o table",
        "az network public-ip list -g rg-finance -o table",
        "az network nic show -g rg-finance -n nic-finance --query ipConfigurations",
      ],
      conceptTitle: "Private IP vs Public IP",
      concept:
        "Private IP vive no espaço da VNet. Para origem Internet é necessário Public IP na NIC, Load Balancer, NAT Gateway, Bastion ou VPN. NSG Allow sem caminho L3 não estabelece sessão.",
      prevention:
        "Trate RDP/SSH da internet como anti-padrão. Use Bastion, Private Endpoints e Just-in-Time. Alertar em pipeline se NIC Standard ficar sem PIP/Bastion e alguém esperar acesso público.",
    },
  };
