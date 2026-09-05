import type { Lab } from "../types";

export const lab: Lab = {
    id: "vpn-overlap",
    code: "INC-3244",
    title: "VPN Connected, rotas on-prem não aparecem",
    difficulty: "n3",
    technologies: ["vpn", "vnet", "route-table", "private-ip"],
    severity: "Sev2",
    etaMin: 18,
    ticket: {
      title: "S2S up, mas DC 10.1.10.10 inacessível",
      reporter: "Identidade · ADDS",
      service: "rg-hub / vpn-s2s-onprem",
      openedAt: "2026-08-28T19:04:00-03:00",
      description:
        "Túnel IPsec com o datacenter mostra Connected. Ningém alcança 10.1.10.10 (AD). Address space da VNet foi definido como 10.1.0.0/16 no landing zone. On-prem também é 10.1.0.0/16.",
      symptoms: [
        "ConnectionStatus = Connected",
        "Effective routes da NIC não listam 10.1.10.10/32 nem 10.1.0.0/16 via gateway",
        "Ping 10.1.10.10 timeout",
      ],
      impact: "Join de domínio e autenticação LDAP falham nas VMs cloud.",
      lastChange: "Landing zone vnet-hub criada com CIDR copiado da planilha on-prem.",
    },
    topology: {
      nodes: [
        { id: "onprem", kind: "onprem", label: "On-prem AD", sublabel: "10.1.0.0/16", x: 16, y: 28, status: "warn" },
        { id: "vpn", kind: "vpn", label: "vpn-s2s-onprem", sublabel: "Connected", x: 50, y: 28, status: "ok" },
        { id: "vnet", kind: "vnet", label: "vnet-hub  10.1.0.0/16", x: 28, y: 48, w: 50, h: 40, status: "error" },
        { id: "vm", kind: "vm", label: "vm-id-01", sublabel: "10.1.2.6", x: 52, y: 68, status: "warn", parentId: "vnet" },
      ],
      edges: [
        { from: "onprem", to: "vpn", kind: "vpn", label: "IPsec up" },
        { from: "vpn", to: "vnet", kind: "blocked", label: "CIDR overlap" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0010-4e11-9c01-vpn",
      resourceGroup: "rg-hub",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-hub",
          space: ["10.1.0.0/16"],
          subnets: [
            { name: "GatewaySubnet", prefix: "10.1.255.0/27" },
            { name: "snet-id", prefix: "10.1.2.0/24" },
          ],
        },
      ],
      nsgs: [],
      routeTables: [],
      vms: [
        {
          name: "vm-id-01",
          os: "windows",
          vnet: "vnet-hub",
          subnet: "snet-id",
          privateIp: "10.1.2.6",
          nic: "nic-id-01",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [],
      lbs: [],
      firewalls: [],
      vpns: [
        {
          name: "vpn-s2s-onprem",
          status: "Connected",
          gateway: "vpngw-hub",
          local: "10.1.0.0/16",
          remote: "10.1.0.0/16",
          localPrefixes: ["10.1.0.0/16"],
          remotePrefixes: ["10.1.0.0/16"],
          overlap: true,
        },
      ],
      dnsZones: [],
      publicIps: [],
    },
    connectivity: [
      { from: "vm-id-01", to: "10.1.10.10", proto: "icmp", result: "no-route", note: "overlap, rota local vence" },
      { from: "vm-id-01", to: "10.1.2.6", proto: "icmp", result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "PSK do IPsec está errada", correct: false },
      { id: "b", label: "NSG nega LDAP 389", correct: false },
      { id: "c", label: "Address space da VNet overlap com on-prem — rotas não são programadas", correct: true },
      { id: "d", label: "BGP ASN duplicado", correct: false },
    ],
    hints: [
      "Connected ≠ tráfego fluindo. Confirme se o prefixo remoto entrou na effective route table.",
      "Compare address space da VNet com os address prefixes do Local Network Gateway.",
      "Ambos são 10.1.0.0/16. Azure recusa instalar rota distante que overlap com a VNet. O /16 local ganha e o DC 'some'.",
    ],
    debrief: {
      rootCause:
        "Overlap de CIDR. VNet e on-prem anunciam 10.1.0.0/16. O gateway estabelece o túnel, mas não programa rotas conflitantes. Destinos 10.1.10.10 são tratados como VnetLocal e nunca saem pelo IPsec.",
      solution:
        "Renumerar um dos lados (preferível a VNet) para um espaço não sobreposto, recriar gateway/connection e validar effective routes com next hop VirtualNetworkGateway.",
      commands: [
        "az network vpn-connection show -g rg-hub -n vpn-s2s-onprem --query connectionStatus",
        "az network vnet show -g rg-hub -n vnet-hub --query addressSpace",
        "az network nic show-effective-route-table -g rg-hub --nic-name nic-id-01 -o table",
      ],
      conceptTitle: "Overlap de address space em VPN",
      concept:
        "Azure não roteia prefixos sobrepostos pelo gateway. O túnel pode ficar Connected (fase 1/2 IKE) mesmo sem rotas úteis. Sempre desenhe IPAM cloud × on-prem antes do landing zone.",
      prevention:
        "IPAM central. Recusar Terraform se vnet.address_space ∩ local_network_gateway.address_space ≠ ∅. Reservar supernets cloud (ex. 10.64.0.0/10) distintas do datacenter.",
    },
  };
