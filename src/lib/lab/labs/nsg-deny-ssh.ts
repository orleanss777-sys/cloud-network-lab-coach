import { defaultNsgRules, type Lab } from "../types";

const nsg = defaultNsgRules();

export const lab: Lab = {
    id: "nsg-deny-ssh",
    code: "INC-1024",
    title: "SSH recusado no jumpbox de produção",
    difficulty: "iniciante",
    technologies: ["nsg", "ports", "public-ip", "vnet", "subnet", "private-ip"],
    severity: "Sev2",
    etaMin: 10,
    ticket: {
      title: "Timeout em SSH para vm-jumpbox",
      reporter: "Ana Ribeiro · AppOps",
      service: "rg-app-prod / vm-jumpbox",
      openedAt: "2026-09-05T08:12:00-03:00",
      description:
        "O time de aplicação não consegue mais acessar o jumpbox Linux usado para manutenção. O IP público 20.119.44.18 responde a ping segundo o operador, mas a sessão SSH na porta 22 não estabelece. A VM aparece Running no portal.",
      symptoms: [
        "ssh azureuser@20.119.44.18 trava em 'Connecting'",
        "VM power state = running",
        "Nenhuma alteração de senha recente",
      ],
      impact: "Manutenção de app-api bloqueada. Sem jump host para o subnet de aplicação.",
      lastChange: "Há 2 h: alteração em nsg-jump por pipeline net-guard.",
    },
    topology: {
      nodes: [
        { id: "inet", kind: "internet", label: "Internet", x: 50, y: 8 },
        { id: "pip", kind: "pip", label: "pip-jump", sublabel: "20.119.44.18", x: 50, y: 22, status: "ok" },
        { id: "vnet", kind: "vnet", label: "vnet-app  10.10.0.0/16", x: 18, y: 34, w: 64, h: 56 },
        { id: "snet", kind: "subnet", label: "snet-jump", sublabel: "10.10.1.0/24", x: 28, y: 48, w: 44, h: 34, parentId: "vnet" },
        { id: "nsg", kind: "nsg", label: "nsg-jump", x: 34, y: 54, status: "error", parentId: "snet" },
        { id: "vm", kind: "vm", label: "vm-jumpbox", sublabel: "10.10.1.4", x: 54, y: 66, status: "warn", parentId: "snet" },
      ],
      edges: [
        { from: "inet", to: "pip", kind: "ok", label: "ICMP" },
        { from: "pip", to: "nsg", kind: "blocked", label: "TCP/22" },
        { from: "nsg", to: "vm", kind: "dashed" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0001-4e11-9c01-jumpbox",
      resourceGroup: "rg-app-prod",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-app",
          space: ["10.10.0.0/16"],
          subnets: [{ name: "snet-jump", prefix: "10.10.1.0/24", nsg: "nsg-jump" }],
        },
      ],
      nsgs: [
        {
          name: "nsg-jump",
          rules: [
            {
              name: "Deny-SSH-Any",
              priority: 100,
              direction: "Inbound",
              access: "Deny",
              protocol: "Tcp",
              source: "*",
              sourcePort: "*",
              dest: "*",
              destPort: "22",
            },
            {
              name: "Allow-SSH",
              priority: 200,
              direction: "Inbound",
              access: "Allow",
              protocol: "Tcp",
              source: "*",
              sourcePort: "*",
              dest: "*",
              destPort: "22",
            },
            ...nsg,
          ],
        },
      ],
      routeTables: [],
      vms: [
        {
          name: "vm-jumpbox",
          os: "linux",
          vnet: "vnet-app",
          subnet: "snet-jump",
          privateIp: "10.10.1.4",
          publicIp: "20.119.44.18",
          nsg: "nsg-jump",
          nic: "nic-jumpbox",
          power: "VM running",
          size: "Standard_B2s",
        },
      ],
      peerings: [],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [{ name: "pip-jump", ip: "20.119.44.18", sku: "Standard", attachedTo: "nic-jumpbox" }],
    },
    connectivity: [
      { from: "internet", to: "20.119.44.18", proto: "icmp", result: "ok" },
      { from: "internet", to: "20.119.44.18", proto: "tcp", port: 22, result: "timeout", note: "NSG Deny-SSH-Any pri 100" },
      { from: "internet", to: "20.119.44.18", proto: "tcp", port: 443, result: "timeout" },
      { from: "vm-jumpbox", to: "8.8.8.8", proto: "icmp", result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "A VM está deallocated / o agente Linux caiu", correct: false },
      { id: "b", label: "NSG nsg-jump tem Deny TCP/22 com prioridade mais alta que o Allow", correct: true },
      { id: "c", label: "O IP público não está associado à NIC", correct: false },
      { id: "d", label: "UDR envia 22/TCP para um NVA inexistente", correct: false },
    ],
    hints: [
      "Ping e SSH usam caminhos diferentes. ICMP ok não prova que TCP/22 está permitido.",
      "Liste as regras inbound de nsg-jump ordenadas por prioridade. Número menor avalia primeiro.",
      "Existe um Deny para a porta 22 em prioridade 100 e um Allow em 200. O Deny ganha.",
    ],
    debrief: {
      rootCause:
        "A regra Deny-SSH-Any (pri 100) bloqueia TCP/22 de qualquer origem. Allow-SSH (pri 200) nunca é avaliada. ICMP continua permitido pelas regras padrão, por isso o ping funciona.",
      solution:
        "Remova Deny-SSH-Any ou suba a prioridade do Allow acima de 100, restringindo a origem ao prefixo corporativo. Evite Allow * em produção.",
      commands: [
        "az network nsg rule list -g rg-app-prod --nsg-name nsg-jump -o table",
        "az network nic list-effective-nsg -g rg-app-prod --nic-name nic-jumpbox",
        "az network nsg rule delete -g rg-app-prod --nsg-name nsg-jump -n Deny-SSH-Any",
      ],
      conceptTitle: "Prioridade de NSG",
      concept:
        "NSG avalia regras do menor para o maior número de prioridade. O primeiro match (Allow ou Deny) encerra a avaliação para aquele fluxo. Regras 65000+ são default e só valem se nada personalizado casar.",
      prevention:
        "Use Infrastructure as Code com review de regras Deny. Prefira Allow com source conhecido; Deny explícito em prioridade baixa só quando for a intenção. Valide com Network Watcher IP flow verify depois de cada mudança.",
    },
  };
