# Traffic Evaluation Tool

A modern, interactive traffic evaluation tool built with React, Vite, and React Flow.

## features

- **Interactive Topology**: visual drag-and-drop node editing.
- **Traffic Simulation**: Adjust global traffic multiplier and see immediate impact.
- **Bottleneck Detection**:
  - 🟢 **Normal**: Traffic within limits.
  - 🟠 **Warning**: Traffic exceeds Rate Limit.
  - 🔴 **Critical**: Traffic exceeds Max Capacity.
- **Configurable Nodes**: Set Daily QPS, Max QPS, and Rate Limits for each service.
- **Import/Export**: Save your topology to JSON.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

## Usage

- **Add Node**: Click the "+ Add Node" button in the top right.
- **Connect Nodes**: Drag from the bottom handle of one node to the top handle of another (Upstream -> Downstream).
- **Edit Node**: Click on a node to open the properties panel on the right.
- **Set Entry**: Mark a node as "Entry Node" to make it generate traffic based on the multiplier.
- **Evaluate**: Adjust the "Traffic Multiplier" input to scale the traffic.

## Color Guide

- **Green Border**: Healthy.
- **Orange Border**: Rate Limited (Warning).
- **Red Border**: Over Capacity (Failure).
