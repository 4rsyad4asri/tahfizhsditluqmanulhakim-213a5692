import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface LevelData {
  name: string;
  value: number;
  pct: number;
}

interface LevelDistributionChartProps {
  levelData: LevelData[];
  levelColors: string[];
}

const LevelDistributionChart: React.FC<LevelDistributionChartProps> = ({ levelData, levelColors }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={levelData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={3}
          label={({ name, pct }) => `${name} (${pct}%)`}
          labelLine={false}
        >
          {levelData.map((_, i) => (
            <Cell key={i} fill={levelColors[i % levelColors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
          formatter={(value: number, name: string) => [`${value} siswa`, name]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default LevelDistributionChart;
