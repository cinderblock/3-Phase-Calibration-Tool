import ChartjsNode from 'chartjs-node';
import { ProcessedData } from '../../processes/Calibration';

// TODO: import from smooth-control
const cycle = 3 * 256;

export default async function writeLookupTableToPNG(
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
          label: 'Lookup',
          data: processed.inverseTable.map((y, x) => ({ x, y })),
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
              labelString: 'Alpha / 4',
            },
            type: 'linear',
            ticks: {
              stepSize: 2 ** 9,
            },
          },
        ],
        yAxes: [
          {
            scaleLabel: {
              fontSize: 24,
              display: true,
              labelString: 'Drive Angle',
            },
            ticks: {
              stepSize: cycle,
              major: {
                stepSize: cyclesPerRev,
              },
              beginAtZero: true,
            },
          },
        ],
      },
    },
  });

  await await chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}
