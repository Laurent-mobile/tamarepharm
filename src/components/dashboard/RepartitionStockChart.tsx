// components/dashboard/RepartitionStockChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useState, useEffect } from 'react';

interface RepartitionStockChartProps {
  data: any[];
  height?: number;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#EC4899',
  '#14B8A6', '#F43F5E', '#8B5CF6', '#06B6D4', '#84CC16'
];

export function RepartitionStockChart({ data, height = 300 }: RepartitionStockChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{payload[0].name}</p>
          <p className="text-purple-600">
            <span className="font-medium">Stock: </span>
            {payload[0].value.toLocaleString('fr-FR')} unités
          </p>
          <p className="text-gray-600 text-sm">
            {((payload[0].value / data.reduce((sum, item) => sum + item.quantite, 0)) * 100).toFixed(1)}% du stock total
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    if (!payload) return null;
    
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-700">
              {entry.value.length > 20 ? entry.value.substring(0, 20) + '...' : entry.value}
            </span>
            <span className="text-gray-500 font-medium">
              ({entry.payload.value})
            </span>
          </div>
        ))}
      </div>
    );
  };

  const chartData = data && data.length > 0 ? data : [
    { nom: 'Aucun stock', quantite: 1 }
  ];

  if (!isMounted) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height: `${height}px` }}
      >
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
          <p>Chargement du graphique...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full bg-white rounded-lg border border-gray-200 p-4"
      style={{ 
        height: `${height}px`,
        width: '100%',
        minWidth: '400px',
        minHeight: '250px'
      }}
    >
      <ResponsiveContainer 
        width="100%" 
        height="80%"
        minWidth={400}
        minHeight={200}
      >
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={120}
            fill="#8884d8"
            dataKey="quantite"
            nameKey="nom"
            label={({ nom, percent }) => 
              percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
            }
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <Legend content={<CustomLegend />} />
    </div>
  );
}
