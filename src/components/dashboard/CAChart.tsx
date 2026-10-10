// components/dashboard/CAChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CAChartProps {
  data: any[];
  periode: 'jour' | 'semaine' | 'mois';
  height?: number;
}

export function CAChart({ data, periode, height = 300 }: CAChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Attendre que le composant soit monté dans le DOM
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
          <p className="text-emerald-600">
            <span className="font-medium">Chiffre d'Affaires: </span>
            {payload[0].value.toLocaleString('fr-FR')} F
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (tick: number) => {
    if (tick >= 1000000) {
      return `${(tick / 1000000).toFixed(1)}M`;
    }
    if (tick >= 1000) {
      return `${(tick / 1000).toFixed(0)}K`;
    }
    return `${tick}`;
  };

  // Données par défaut si pas de données
  const chartData = data && data.length > 0 ? data : [
    { periode: 'Aucune donnée', chiffreAffaire: 0 }
  ];

  const ChartComponent = periode === 'jour' ? LineChart : BarChart;

  if (!isMounted) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height: `${height}px` }}
      >
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
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
        minWidth: '400px', // Largeur minimum garantie
        minHeight: '250px' // Hauteur minimum garantie
      }}
    >
      <ResponsiveContainer 
        width="100%" 
        height="100%"
        minWidth={400}
        minHeight={250}
      >
        <ChartComponent
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis 
            dataKey="periode" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 11 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          {periode === 'jour' ? (
            <Line
              type="monotone"
              dataKey="chiffreAffaire"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: "#10B981", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "#059669" }}
            />
          ) : (
            <Bar 
              dataKey="chiffreAffaire" 
              fill="#10B981"
              radius={[4, 4, 0, 0]}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
