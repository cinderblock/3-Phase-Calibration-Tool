import ChartjsNode from 'chartjs-node';
import { DataPoint } from '../../../DataPoint';

// TODO: import from smooth-control
const cycle = 3 * 256;

export default async function writeRawXYZToPNG(
  filename: string,
  dataPoints: DataPoint[],
  revolutions = dataPoints.length / cycle,
  width = 600,
  height = width
) {
  const chartNode = new ChartjsNode(width, height);
  const cyclesPerRev = cycle * revolutions;
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'X',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ x }, s) => ({ x: s, y: x })),
          backgroundColor: '#ff0000',
        },
        {
          label: 'Y',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ y }, s) => ({ x: s, y: y })),
          backgroundColor: '#00ff00',
        },
        {
          label: 'Z',
          yAxisID: 'XYZ',
          data: dataPoints.map(({ z }, s) => ({ x: s, y: z })),
          backgroundColor: '#0000ff',
        },
        {
          label: 'Gain',
          yAxisID: 'VG',
          data: dataPoints.map(({ VG }, s) => ({ x: s, y: VG })),
          backgroundColor: '#000000',
        },
        {
          label: 'Alpha',
          yAxisID: 'Alpha',
          data: dataPoints.map(({ alpha }, s) => ({ x: s, y: alpha })),
          backgroundColor: '#e541f4',
        },
        {
          label: 'Angle',
          yAxisID: 'Angle',
          data: dataPoints.map(({ x, y }, s) => ({
            x: s,
            // y: (Math.atan2(-y, -x) / (Math.PI * 2) + 0.5) * 2 ** 14,
            y: Math.atan2(-y, -x),
          })),
          pointRadius: 7,
          backgroundColor: '#fff45b',
        },
      ],
    },
    options: {
      legend: { labels: { fontSize: 24 } },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            type: 'linear',
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
            },
          },
        ],
        yAxes: [
          {
            id: 'XYZ',
            scaleLabel: { fontSize: 24, display: true, labelString: 'Raw XYZ' },
            type: 'linear',
            position: 'left',
            ticks: {
              beginAtZero: true,
            },
          },
          {
            id: 'VG',
            scaleLabel: { fontSize: 24, display: true, labelString: 'Gain' },
            type: 'linear',
            position: 'right',
            ticks: {
              beginAtZero: true,
            },
          },
          {
            id: 'Alpha',
            type: 'linear',
            position: 'right',
            display: false,
            ticks: { min: 0, max: 2 ** 14 },
          },
          {
            id: 'Angle',
            type: 'linear',
            position: 'right',
            display: false,
            ticks: { min: -Math.PI, max: Math.PI },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}