import ChartjsNode from 'chartjs-node';
import { ProcessedData } from '../../processes/Calibration';

// TODO: import from smooth-control
const cycle = 3 * 256;

export default async function writeSmoothedDataToPNG(
  filename: string,
  processed: ProcessedData,
  width = 400,
  height = width
) {
  const chartNode = new ChartjsNode(width, height);
  const revolutions = processed.forward.length / cycle;
  const cyclesPerRev = cycle * revolutions;
  await chartNode.drawChart({
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Forward',
          data: processed.forward.map((y, x) => ({ x, y })),
        },
        {
          label: 'Reverse',
          data: processed.reverse.map((y, x) => ({ x, y })),
        },
        {
          label: 'Middle',
          data: processed.middle.map((y, x) => ({ x, y })),
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
