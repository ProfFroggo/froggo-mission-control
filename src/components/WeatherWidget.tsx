import { useState, useEffect } from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudDrizzle, Wind, Droplets, RefreshCw, AlertCircle, Thermometer, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';
import WidgetLoading from './WidgetLoading';

interface WeatherCondition {
  temp_C: string;
  weatherDesc: Array<{ value: string }>;
  humidity: string;
  windspeedKmph: string;
}

interface DayForecast {
  date: string;
  maxtempC: string;
  mintempC: string;
  hourly: Array<{
    weatherDesc: Array<{ value: string }>;
  }>;
}

interface WeatherData {
  current_condition: WeatherCondition[];
  weather: DayForecast[];
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [expanded, setExpanded] = useState(false);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('https://wttr.in/Gibraltar?format=j1');
      if (!response.ok) throw new Error('Failed to fetch weather');
      
      const data = await response.json();
      setWeather(data);
      setLastFetch(Date.now());
    } catch (e: unknown) {
      // 'Failed to fetch weather:', e;
      setError('Could not load weather');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount + refresh every 30 minutes
  useEffect(() => {
    fetchWeather();
    
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getWeatherIcon = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('rain') || desc.includes('shower')) return CloudRain;
    if (desc.includes('snow') || desc.includes('sleet')) return CloudSnow;
    if (desc.includes('drizzle')) return CloudDrizzle;
    if (desc.includes('cloud') || desc.includes('overcast')) return Cloud;
    if (desc.includes('clear') || desc.includes('sunny')) return Sun;
    return Cloud;
  };

  const getWeatherColor = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('rain') || desc.includes('shower')) return 'text-info';
    if (desc.includes('snow') || desc.includes('sleet')) return 'text-cyan-300';
    if (desc.includes('clear') || desc.includes('sunny')) return 'text-warning';
    if (desc.includes('cloud') || desc.includes('overcast')) return 'text-mission-control-text-dim';
    return 'text-mission-control-text-dim';
  };

  const current = weather?.current_condition?.[0];
  const today = weather?.weather?.[0];
  const forecast = weather?.weather?.slice(1, 4); // Next 3 days

  const WeatherIcon = current ? getWeatherIcon(current.weatherDesc[0].value) : Cloud;
  const weatherColor = current ? getWeatherColor(current.weatherDesc[0].value) : 'text-mission-control-text-dim';

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Thermometer size={16} className={weatherColor} />
          <h2 className="font-semibold">Weather</h2>
          <span className="text-xs text-mission-control-text-dim">Gibraltar</span>
        </div>
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="p-2 hover:bg-mission-control-border rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4">
        {loading && !weather ? (
          <WidgetLoading 
            variant="spinner" 
            title="Loading weather..." 
            icon={Cloud}
            compact 
          />
        ) : error ? (
          <div className="text-center py-6 text-mission-control-text-dim">
            <AlertCircle size={32} className="mx-auto mb-2 text-error" />
            <p className="text-sm">{error}</p>
            <button onClick={fetchWeather} className="mt-2 text-xs text-mission-control-accent hover:underline">
              Try again
            </button>
          </div>
        ) : current && today ? (
          <div className="space-y-4">
            {/* Current Weather */}
            <div className="flex items-center gap-4">
              <WeatherIcon size={48} className={weatherColor} />
              <div className="flex-1">
                <div className="text-3xl font-bold">{current.temp_C}°C</div>
                <div className="text-sm text-mission-control-text-dim">{current.weatherDesc[0].value}</div>
              </div>
            </div>

            {/* Today's High/Low */}
            <div className="flex items-center gap-4 pt-4 border-t border-mission-control-border">
              <div className="flex items-center gap-2 flex-1">
                <ArrowUp size={16} className="text-error" />
                <div>
                  <div className="text-xs text-mission-control-text-dim">High</div>
                  <div className="text-lg font-semibold">{today.maxtempC}°</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <ArrowDown size={16} className="text-info" />
                <div>
                  <div className="text-xs text-mission-control-text-dim">Low</div>
                  <div className="text-lg font-semibold">{today.mintempC}°</div>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="flex items-center gap-4 pt-3 border-t border-mission-control-border/50">
              <div className="flex items-center gap-2 text-sm">
                <Droplets size={14} className="text-info" />
                <span className="text-mission-control-text-dim">{current.humidity}%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Wind size={14} className="text-mission-control-text-dim" />
                <span className="text-mission-control-text-dim">{current.windspeedKmph} km/h</span>
              </div>
            </div>

            {/* 3-Day Forecast (Expandable) */}
            {forecast && forecast.length > 0 && (
              <div className="pt-3 border-t border-mission-control-border">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full flex items-center justify-between text-sm font-medium text-mission-control-text-dim hover:text-mission-control-text transition-colors"
                >
                  <span>3-Day Forecast</span>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                
                {expanded && (
                  <div className="mt-3 space-y-2">
                    {forecast.map((day, idx) => {
                      const date = new Date(day.date);
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                      const avgCondition = day.hourly[4]?.weatherDesc[0]?.value || day.hourly[0]?.weatherDesc[0]?.value;
                      const DayIcon = getWeatherIcon(avgCondition);
                      const dayColor = getWeatherColor(avgCondition);
                      
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2 bg-mission-control-bg/30 rounded-lg"
                        >
                          <span className="text-sm font-medium w-10">{dayName}</span>
                          <DayIcon size={20} className={dayColor} />
                          <span className="text-xs text-mission-control-text-dim flex-1 truncate">
                            {avgCondition}
                          </span>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-error/80">{day.maxtempC}°</span>
                            <span className="text-mission-control-text-dim">/</span>
                            <span className="text-info/80">{day.mintempC}°</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {lastFetch > 0 && (
        <div className="px-4 py-2 border-t border-mission-control-border text-xs text-mission-control-text-dim">
          Updated {new Date(lastFetch).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
