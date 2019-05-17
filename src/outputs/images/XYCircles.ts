import ChartjsNode from 'chartjs-node';
import { DataPoint } from '../../DataPoint';

export default async function writeXYPlotToPNG(filename: string, dataPoints: DataPoint[], width = 600, height = width) {
  const chartNode = new ChartjsNode(width, height);
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'XY',
          yAxisID: 'Y',
          data: dataPoints.map(({ x, y, VG }) => ({ x: x / VG, y: y / VG })),
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
              labelString: 'Scaled X',
            },
            type: 'linear',
            ticks: {
              min: -500,
              max: 500,
            },
          },
        ],
        yAxes: [
          {
            id: 'Y',
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Scaled Y',
            },
            type: 'linear',
            ticks: {
              min: -500,
              max: 500,
            },
          },
        ],
      },
    },
  });

  await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}
