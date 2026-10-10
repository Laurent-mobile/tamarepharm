// components/dashboard/ProduitsPlusVendusChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState, useEffect } from 'react';

interface ProduitsPlusVendusChartProps {
  data: any[];
  height?: number;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#EC4899'
];

export function ProduitsPlusVendusChart({ data, height = 300 }: ProduitsPlusVendusChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          <p className="text-blue-600">
            <span className="font-medium">Quantité vendue: </span>
            {payload[0].value.toLocaleString('fr-FR')} unités
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (tick: number) => {
    if (tick >= 1000) {
      return `${(tick / 1000).toFixed(0)}K`;
    }
    return `${tick}`;
  };

  // Tronquer les noms de produits trop longs
  const formatXAxis = (tick: string) => {
    if (tick.length > 15) {
      return tick.substring(0, 15) + '...';
    }
    return tick;
  };

  const chartData = data && data.length > 0 ? data : [
    { nom: 'Aucune donnée', quantite: 0 }
  ];

  if (!isMounted) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height: `${height}px` }}
      >
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
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
        height="100%"
        minWidth={400}
        minHeight={250}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{
            top: 20,
            right: 30,
            left: 100,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
          <XAxis 
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickFormatter={formatYAxis}
          />
          <YAxis 
            type="category"
            dataKey="nom"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            width={95}
            tickFormatter={formatXAxis}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="quantite" 
            radius={[0, 4, 4, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
