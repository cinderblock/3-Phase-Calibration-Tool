import ChartjsNode from 'chartjs-node';
import { ProcessedData } from '../../processes/Calibration';

// TODO: import from smooth-control
const cycle = 3 * 256;

export default async function writeRawDataToPNG(
  filename: string,
  processed: ProcessedData,
  revolutions = processed.forward.length / cycle,
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
          label: 'Forward',
          data: processed.forwardData.map((y, x) => ({ x, y })),
          // backgroundColor: '#00ff00',
          backgroundColor: '#00ff00',
        },
        {
          label: 'Reverse',
          data: processed.reverseData.map((y, x) => ({ x, y })),
          backgroundColor: '#ff0000',
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

  chartNode.writeImageToFile('image/png', filename);

  chartNode.destroy();
}
