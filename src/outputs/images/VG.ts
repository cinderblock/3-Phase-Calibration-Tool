import ChartjsNode from 'chartjs-node';
import { DataPoint } from '../../DataPoint';

// TODO: import from smooth-control
const cycle = 3 * 256;

export default async function writeVGToPNG(
  filename: string,
  dataPoints: DataPoint[],
  revolutions = dataPoints.length / cycle,
  width = 600,
  height = 100
) {
  const chartNode = new ChartjsNode(width, height);
  const cyclesPerRev = cycle * revolutions;
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Gain',
          data: dataPoints.map(({ VG }, s) => ({ x: s, y: VG })),
          backgroundColor: '#000000',
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
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}
