import type { Lab } from "../types";

export const lab: Lab = {
    id: "azfw-missing-443",
    code: "INC-3170",
    title: "HTTPS para API parceira morre no Firewall",
    difficulty: "n3",
    technologies: ["firewall", "route-table", "ports", "dns"],
    severity: "Sev2",
    etaMin: 18,
    ticket: {
      title: "api.partner.com:443 timeout a partir de vm-app-01",
      reporter: "Integrações · B2B",
      service: "rg-hub / azfw-hub",
      openedAt: "2026-08-29T15:33:00-03:00",
      description:
        "Egresso do spoke é forçado para Azure Firewall (UDR 0.0.0.0/0). HTTP http://api.partner.com funciona. HTTPS não. Policy tem network rule Allow-Web TCP/80 para *. DNS resolve.",
      symptoms: [
        "curl -I http://api.partner.com → 200",
        "curl -I https://api.partner.com → timeout",
        "nslookup api.partner.com ok",
      ],
      impact: "Integração de pagamentos falha (só HTTPS).",
      lastChange: "Go-live do Azure Firewall; regras copiadas do proxy antigo (80).",
    },
    topology: {
      nodes: [
        { id: "spoke", kind: "vnet", label: "vnet-spoke  10.20.0.0/16", x: 6, y: 28, w: 36, h: 50 },
        { id: "vm", kind: "vm", label: "vm-app-01", sublabel: "10.20.2.6", x: 22, y: 52, status: "warn", parentId: "spoke" },
        { id: "hub", kind: "vnet", label: "vnet-hub  10.0.0.0/16", x: 48, y: 22, w: 30, h: 56 },
        { id: "fw", kind: "fw", label: "azfw-hub", sublabel: "10.0.1.4", x: 62, y: 48, status: "error", parentId: "hub" },
        { id: "inet", kind: "internet", label: "api.partner.com", x: 88, y: 48 },
      ],
      edges: [
        { from: "vm", to: "fw", kind: "ok", label: "0.0.0.0/0" },
        { from: "fw", to: "inet", kind: "blocked", label: "TCP/443" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0009-4e11-9c01-fw",
      resourceGroup: "rg-hub",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-hub",
          space: ["10.0.0.0/16"],
          subnets: [{ name: "AzureFirewallSubnet", prefix: "10.0.1.0/24" }],
        },
        {
          name: "vnet-spoke",
          space: ["10.20.0.0/16"],
          subnets: [{ name: "snet-app", prefix: "10.20.2.0/24", routeTable: "rt-spoke" }],
        },
      ],
      nsgs: [],
      routeTables: [
        {
          name: "rt-spoke",
          routes: [{ name: "to-azfw", prefix: "0.0.0.0/0", nextHopType: "VirtualAppliance", nextHopIp: "10.0.1.4" }],
        },
      ],
      vms: [
        {
          name: "vm-app-01",
          os: "linux",
          vnet: "vnet-spoke",
          subnet: "snet-app",
          privateIp: "10.20.2.6",
          nic: "nic-app-01",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [
        {
          name: "spoke-to-hub",
          vnet: "vnet-spoke",
          remote: "vnet-hub",
          allowForwarded: true,
          allowGateway: false,
          useRemoteGw: false,
          state: "Connected",
        },
        {
          name: "hub-to-spoke",
          vnet: "vnet-hub",
          remote: "vnet-spoke",
          allowForwarded: true,
          allowGateway: false,
          useRemoteGw: false,
          state: "Connected",
        },
      ],
      lbs: [],
      firewalls: [
        {
          name: "azfw-hub",
          privateIp: "10.0.1.4",
          policy: "azfw-policy-hub",
          networkRules: [
            {
              name: "Allow-Web",
              source: "10.20.0.0/16",
              dest: "*",
              ports: "80",
              proto: "TCP",
              action: "Allow",
            },
          ],
          appRules: [],
        },
      ],
      vpns: [],
      dnsZones: [],
      publicIps: [],
    },
    connectivity: [
      { from: "vm-app-01", to: "api.partner.com", proto: "dns", result: "ok" },
      { from: "vm-app-01", to: "api.partner.com", proto: "tcp", port: 80, result: "ok" },
      { from: "vm-app-01", to: "api.partner.com", proto: "tcp", port: 443, result: "timeout", note: "sem regra 443 no AZFW" },
    ],
    hypotheses: [
      { id: "a", label: "DNS quebra o nome em IPv6 e o firewall dropa", correct: false },
      { id: "b", label: "Network rule permite só TCP/80; 443 não tem allow", correct: true },
      { id: "c", label: "UDR aponta para o IP errado do firewall", correct: false },
      { id: "d", label: "NSG da AzureFirewallSubnet bloqueia 443", correct: false },
    ],
    hints: [
      "HTTP ok e HTTPS timeout no mesmo FQDN, com DNS ok, aponta para filtro de porta no hop intermediário.",
      "Liste network-rule e application-rule da policy do Azure Firewall. Veja dest ports.",
      "Allow-Web libera apenas 80. Não há application rule para api.partner.com. 443 cai no deny implícito.",
    ],
    debrief: {
      rootCause:
        "Azure Firewall deny-by-default. A network rule cobre TCP/80. HTTPS (443) não tem network nem application rule, então é dropado. Por isso HTTP passa e HTTPS não.",
      solution:
        "Adicione network rule TCP/443 ou application rule https://api.partner.com. Prefira FQDN em application rule para B2B.",
      commands: [
        "az network firewall network-rule collection list -g rg-hub --firewall-name azfw-hub -o json",
        "az network firewall application-rule collection list -g rg-hub --firewall-name azfw-hub",
        "az network firewall show -g rg-hub -n azfw-hub --query ipConfigurations",
      ],
      conceptTitle: "Azure Firewall: network vs application rule",
      concept:
        "Network rules filtram L3/L4 (IP/porta). Application rules filtram L7 (FQDN/SNI). Não há allow implícito de 443. Deny implícito no fim da policy.",
      prevention:
        "Catálogo de egresso por FQDN, não por 'web = 80'. Teste curl HTTP e HTTPS no pipeline de firewall. Logue AZFWNetworkRule e AZFWApplicationRule no Log Analytics.",
    },
  };
