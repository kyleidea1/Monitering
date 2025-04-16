// monitoring.js
const promClient = require('prom-client');

// 새로운 레지스트리 생성 (이미 기본 레지스트리가 있다면 대신 사용할 수 있음)
const register = new promClient.Registry();

// HTTP 요청 수 카운터
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'status'],
});
register.registerMetric(httpRequestsTotal);

// HTTP 요청 처리 시간 히스토그램
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Histogram of HTTP request duration in seconds',
  labelNames: ['method', 'status'],
  buckets: [0.1, 0.3, 1.5, 5, 10],
});
register.registerMetric(httpRequestDuration);

// CPU 사용량 게이지
const cpuUsage = new promClient.Gauge({
  name: 'cpu_usage_percentage',
  help: 'CPU usage percentage',
});
register.registerMetric(cpuUsage);

// 메모리 사용량 게이지
const memoryUsage = new promClient.Gauge({
  name: 'memory_usage_bytes',
  help: 'Active memory usage in bytes',
});
register.registerMetric(memoryUsage);

// 디스크 사용량 게이지
const diskSpace = new promClient.Gauge({
  name: 'disk_space_available_bytes',
  help: 'Available disk space in bytes',
});
register.registerMetric(diskSpace);

// 네트워크 수신 바이트 카운터
const networkReceive = new promClient.Counter({
  name: 'network_receive_bytes_total',
  help: 'Total number of bytes received on network interface',
});
register.registerMetric(networkReceive);

/**
 * 시스템 메트릭 (노드 메트릭)을 업데이트 하는 함수
 * node_exporter나 node.js에서 제공하는 메트릭에 의존하는 경우가 있으므로
 * 해당 메트릭의 이름과 로직을 실제 환경에 맞게 조정하세요.
 */
async function updateSystemMetrics() {
  try {
    // CPU 사용량 측정
    const cpuUsageData = await promClient.register.getSingleMetric('node_cpu_seconds_total');
    if (cpuUsageData && cpuUsageData.values) {
      const cpuTotal = cpuUsageData.values.reduce((total, value) => total + value.value, 0);
      const cpuIdleMetric = cpuUsageData.values.find(v => v.labels.mode === 'idle');
      if (cpuIdleMetric) {
        const cpuUsagePercentage = ((cpuTotal - cpuIdleMetric.value) / cpuTotal) * 100;
        cpuUsage.set(cpuUsagePercentage);
      } else {
        console.error('Error: CPU idle metric not found');
      }
    } else {
      console.error('Error: CPU usage data not found');
    }

    // 메모리 사용량 측정
    const memoryUsageData = await promClient.register.getSingleMetric('node_memory_Active_bytes');
    if (memoryUsageData && memoryUsageData.values) {
      memoryUsage.set(memoryUsageData.values[0].value);
    } else {
      console.error('Error: Memory usage data not found');
    }

    // 디스크 여유 공간 측정
    const diskSpaceData = await promClient.register.getSingleMetric('node_filesystem_avail_bytes');
    if (diskSpaceData && diskSpaceData.values) {
      diskSpace.set(diskSpaceData.values[0].value);
    } else {
      console.error('Error: Disk space data not found');
    }

    // 네트워크 수신 데이터 측정
    const networkReceiveData = await promClient.register.getSingleMetric('node_network_receive_bytes_total');
    if (networkReceiveData && networkReceiveData.values) {
      // 기존 값에 누적하는 경우 `inc`를 사용합니다.
      networkReceive.inc(networkReceiveData.values[0].value);
    } else {
      console.error('Error: Network receive data not found');
    }
  } catch (err) {
    console.error('Error updating system metrics:', err);
  }
}

/**
 * Express 미들웨어 함수: 각 HTTP 요청에 대해 메트릭을 측정합니다.
 */
function monitoringMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, status: res.statusCode });
    end({ method: req.method, status: res.statusCode });
  });
  next();
}

/**
 * Prometheus가 수집할 메트릭 데이터를 반환하는 함수.
 * 시스템 메트릭 업데이트 후 레지스트리의 메트릭들을 가져옵니다.
 */
async function getMetrics() {
  await updateSystemMetrics();
  return register.metrics();
}

module.exports = {
  monitoringMiddleware,
  getMetrics,
  register, // register를 직접 사용해야 하는 경우를 위해 노출합니다.
};
