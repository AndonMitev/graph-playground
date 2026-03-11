export interface GraphNode {
  id: string | number;
  name?: string;
  group?: number;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number | undefined;
  fy?: number | undefined;
  fz?: number | undefined;
  // Wallet network
  followers?: number;
  balanceEth?: number;
  txCount?: number;
  firstSeen?: string;
  lastActive?: string;
  chain?: string;
  isProtocol?: boolean;
  // Knowledge graph
  category?: string;
  collapsed?: boolean;
  childLinks?: GraphLink[];
  // Org chart
  title?: string;
  department?: string;
  // Network traffic
  type?: string;
  // Cosmos
  temperature?: number;
  size?: number;
}

export interface GraphLink {
  source: string | number | GraphNode;
  target: string | number | GraphNode;
  value?: number;
  color?: string;
  curvature?: number;
  // Network traffic
  traffic?: number;
  bandwidth?: number;
  // Knowledge graph
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
