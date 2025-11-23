import { useState, useMemo } from 'react';
import { ServerMetrics } from '../lib/supabase';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface MetricsChartProps {
  metrics: ServerMetrics[];
  type: 'cpu' | 'memory' | 'disk';
}

type TimeRange = '10min' | '1hour' | '6hour' | '24hour';

export function MetricsChart({ metrics, type }: MetricsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1hour');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const getValue = (metric: ServerMetrics) => {
    switch (type) {
      case 'cpu':
        return metric.cpu_usage;
      case 'memory':
        return metric.memory_percent;
      case 'disk':
        return metric.disk_percent;
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'cpu':
        return 'CPU Usage';
      case 'memory':
        return 'Memory Usage';
      case 'disk':
        return 'Disk Usage';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'cpu':
        return { line: '#3b82f6', gradient: ['#3b82f6', '#1e40af'], fill: 'rgba(59, 130, 246, 0.1)' };
      case 'memory':
        return { line: '#8b5cf6', gradient: ['#8b5cf6', '#6d28d9'], fill: 'rgba(139, 92, 246, 0.1)' };
      case 'disk':
        return { line: '#10b981', gradient: ['#10b981', '#059669'], fill: 'rgba(16, 185, 129, 0.1)' };
    }
  };

  const getTimeRangeInMs = (range: TimeRange) => {
    switch (range) {
      case '10min':
        return 10 * 60 * 1000;
      case '1hour':
        return 60 * 60 * 1000;
      case '6hour':
        return 6 * 60 * 60 * 1000;
      case '24hour':
        return 24 * 60 * 60 * 1000;
    }
  };

  const filteredMetrics = useMemo(() => {
    const now = Date.now();
    const rangeMs = getTimeRangeInMs(timeRange);
    return metrics
      .filter((m) => now - new Date(m.timestamp).getTime() <= rangeMs)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [metrics, timeRange]);

  const currentValue = filteredMetrics.length > 0 ? getValue(filteredMetrics[filteredMetrics.length - 1]) : 0;
  const previousValue = filteredMetrics.length > 1 ? getValue(filteredMetrics[filteredMetrics.length - 2]) : currentValue;
  const trend = currentValue - previousValue;

  const maxValue = Math.max(...filteredMetrics.map(getValue), 100);
  const minValue = Math.min(...filteredMetrics.map(getValue), 0);

  const chartWidth = 800;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const points = filteredMetrics.map((metric, index) => {
    const x = padding.left + (index / Math.max(filteredMetrics.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - ((getValue(metric) - minValue) / (maxValue - minValue)) * innerHeight;
    return { x, y, value: getValue(metric), timestamp: metric.timestamp };
  });

  const linePath = points.length > 0
    ? points.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const prevPoint = points[index - 1];
        const cpX = (prevPoint.x + point.x) / 2;
        return `${path} Q ${cpX} ${prevPoint.y}, ${cpX} ${(prevPoint.y + point.y) / 2} Q ${cpX} ${point.y}, ${point.x} ${point.y}`;
      }, '')
    : '';

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${padding.left} ${padding.top + innerHeight} Z`
    : '';

  const yAxisTicks = [0, 25, 50, 75, 100];
  const xAxisTicks = filteredMetrics.length > 0
    ? [0, Math.floor(filteredMetrics.length / 3), Math.floor(filteredMetrics.length * 2 / 3), filteredMetrics.length - 1]
    : [];

  const colors = getColor();

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">{getLabel()}</h3>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-white">
                {currentValue.toFixed(1)}%
              </span>
              {trend !== 0 && (
                <div className={`flex items-center ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {trend > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span className="text-sm ml-1">{Math.abs(trend).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <div className="flex gap-1 bg-gray-900/50 rounded-lg p-1">
            {(['10min', '1hour', '6hour', '24hour'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  timeRange === range
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {range === '10min' ? '10m' : range === '1hour' ? '1h' : range === '6hour' ? '6h' : '24h'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredMetrics.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No data available for this time range</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id={`gradient-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={colors.gradient[0]} stopOpacity="0.3" />
                <stop offset="100%" stopColor={colors.gradient[1]} stopOpacity="0.05" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + innerHeight}
              stroke="#374151"
              strokeWidth="1"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + innerHeight}
              stroke="#374151"
              strokeWidth="1"
            />

            {yAxisTicks.map((tick) => {
              const y = padding.top + innerHeight - ((tick - minValue) / (maxValue - minValue)) * innerHeight;
              return (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + innerWidth}
                    y2={y}
                    stroke="#374151"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.3"
                  />
                  <text
                    x={padding.left - 10}
                    y={y}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    fill="#9ca3af"
                    fontSize="12"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            {xAxisTicks.map((tickIndex) => {
              if (tickIndex >= filteredMetrics.length) return null;
              const metric = filteredMetrics[tickIndex];
              const x = padding.left + (tickIndex / Math.max(filteredMetrics.length - 1, 1)) * innerWidth;
              const time = new Date(metric.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
              return (
                <text
                  key={tickIndex}
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="11"
                >
                  {time}
                </text>
              );
            })}

            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#gradient-${type})`}
              />
            )}

            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={colors.line}
                strokeWidth="2.5"
                filter="url(#glow)"
              />
            )}

            {points.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPoint === index ? 6 : 3}
                  fill={colors.line}
                  stroke="white"
                  strokeWidth={hoveredPoint === index ? 2 : 0}
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {hoveredPoint === index && (
                  <g>
                    <rect
                      x={point.x - 60}
                      y={point.y - 50}
                      width="120"
                      height="40"
                      fill="#1f2937"
                      stroke="#374151"
                      strokeWidth="1"
                      rx="6"
                    />
                    <text
                      x={point.x}
                      y={point.y - 32}
                      textAnchor="middle"
                      fill="white"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {point.value.toFixed(1)}%
                    </text>
                    <text
                      x={point.x}
                      y={point.y - 16}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize="11"
                    >
                      {new Date(point.timestamp).toLocaleTimeString()}
                    </text>
                  </g>
                )}
              </g>
            ))}
          </svg>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <div>
              <span className="text-gray-400">Data points: </span>
              <span className="text-white font-semibold">{filteredMetrics.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Min: </span>
              <span className="text-white font-semibold">{minValue.toFixed(1)}%</span>
              <span className="text-gray-400 ml-4">Max: </span>
              <span className="text-white font-semibold">{maxValue.toFixed(1)}%</span>
              <span className="text-gray-400 ml-4">Avg: </span>
              <span className="text-white font-semibold">
                {(filteredMetrics.reduce((sum, m) => sum + getValue(m), 0) / filteredMetrics.length).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
