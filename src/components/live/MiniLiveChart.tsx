import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface MiniLiveChartProps {
  data: { time: string; rpm: number; speed: number; coolant: number }[]
}

export const MiniLiveChart: React.FC<MiniLiveChartProps> = ({ data }) => {
  return (
    <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFB300]" />
          <h3 className="font-bold text-sm text-white">
            Gráfico Dinâmico Multivariável (RPM • Velocidade • Arrefecimento)
          </h3>
        </div>
        <span className="text-xs text-[#9AA7B4]">Atualização contínua em tempo real</span>
      </div>

      <div className="h-[220px] w-full">
        {data.length < 2 ? (
          <div className="h-full flex items-center justify-center text-xs text-[#9AA7B4] font-mono">
            Aguardando fluxo de telemetria OBD-II...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263340" vertical={false} />
              <XAxis dataKey="time" stroke="#9AA7B4" tick={{ fontSize: 10 }} />
              {/* Eixo Y primário para RPM */}
              <YAxis yAxisId="rpm" domain={[0, 'auto']} stroke="#FFB300" tick={{ fontSize: 10 }} />
              {/* Eixo Y secundário para Velocidade e Temp */}
              <YAxis
                yAxisId="sec"
                orientation="right"
                domain={[0, 160]}
                stroke="#26C6DA"
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A232E',
                  borderColor: '#263340',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Line
                yAxisId="rpm"
                type="monotone"
                dataKey="rpm"
                name="RPM (0x0C)"
                stroke="#FFB300"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="sec"
                type="monotone"
                dataKey="speed"
                name="Velocidade km/h (0x0D)"
                stroke="#26C6DA"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="sec"
                type="monotone"
                dataKey="coolant"
                name="Temp °C (0x05)"
                stroke="#EF5350"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
