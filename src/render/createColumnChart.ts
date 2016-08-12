import { ComposeFactory } from 'dojo-compose/compose';
import { assign } from 'dojo-core/lang';
import { find } from 'dojo-shim/array';
import Set from 'dojo-shim/Set';
import WeakMap from 'dojo-shim/WeakMap';
import { VNodeListeners } from 'dojo-widgets/mixins/createVNodeEvented';
import { h, VNode } from 'maquette/maquette';

import { Datum } from '../data/interfaces';

import createChart, { Chart, ChartOptions, ChartState } from './createChart';
import createAxes, { Axes, AxesOptions } from './mixins/createAxesMixin';
import createColumnPlot, {
	Column,
	ColumnPoint,
	ColumnPlot,
	ColumnPlotOptions,
	ColumnPlotState,
	ColumnPointPlot,
	SelectColumnEvent
} from './mixins/createColumnPlotMixin';

export { Column, ColumnPoint, ColumnPointPlot, SelectColumnEvent }

export type ColumnChartState<T> = ChartState & ColumnPlotState<T>;

export type ColumnChartOptions<
	T,
	// Extend Datum<any> so subclasses can use their own datum type without having to extend from Column<T>.
	D extends Datum<any>,
	// Extend ColumnChartState<T> since subclasses must still support the state properties of ColumnChart.
	S extends ColumnChartState<T>
> = ChartOptions<S> & ColumnPlotOptions<T, S> & AxesOptions<D>;

export type ColumnChart<
	T,
	// Extend Datum<any> so subclasses can use their own datum type without having to extend from Column<T>.
	D extends Datum<any>,
	// Extend ColumnChartState<T> since subclasses must still support the state properties of ColumnChart.
	S extends ColumnChartState<T>
> = Chart<S> & ColumnPlot<T, S> & Axes<D>;

export interface ColumnChartFactory<T> extends ComposeFactory<
	ColumnChart<T, Column<T>, ColumnChartState<T>>,
	ColumnChartOptions<T, Column<T>, ColumnChartState<T>>
> {
	<T>(
		options?: ColumnChartOptions<T, Column<T>, ColumnChartState<T>>
	): ColumnChart<T, Column<T>, ColumnChartState<T>>;
}

const listeners = new WeakMap<ColumnChart<any, any, any>, VNodeListeners>();
const virtualPlotNodes = new WeakMap<ColumnChart<any, any, any>, VNode[]>();

// Cast to a generic factory so subclasses can modify the datum type.
// The factory should be casted to ColumnChartFactory when creating a column chart.
const createColumnChart: ColumnChartFactory<any> = createChart
	.mixin(createAxes)
	.mixin(createColumnPlot)
	.extend({
		getChildrenNodes(this: ColumnChart<any, any, any>): VNode[] {
			const plot = this.plot();
			if (plot.points.length === 0) {
				return [];
			}

			const { domain, xInset, yInset } = this;
			const nodes: VNode[] = [];

			const axes = this.createAxes(plot, domain);
			let { height: chartHeight, width: chartWidth } = plot;
			chartWidth += axes.extraWidth;
			chartHeight += axes.extraHeight;

			if (axes.bottom) {
				nodes.push(h('g', {
					key: 'bottom-axis',
					transform: `translate(${xInset} ${yInset + chartHeight})`
				}, axes.bottom));
			}
			if (axes.left) {
				nodes.push(h('g', {
					key: 'left-axis',
					transform: `translate(${xInset + 1} ${yInset + axes.extraHeight})`
				}, axes.left));
			}
			if (axes.right) {
				nodes.push(h('g', {
					key: 'right-axis',
					transform: `translate(${xInset + chartWidth} ${yInset + axes.extraHeight})`
				}, axes.right));
			}
			if (axes.top) {
				nodes.push(h('g', {
					key: 'top-axis',
					transform: `translate(${xInset} ${yInset})`
				}, axes.top));
			}

			const groups = this.renderPlotPoints(plot.points, plot.height, axes.extraHeight);
			nodes.push(h('g', assign({
				key: 'plot',
				'transform': `translate(${xInset} ${yInset + axes.extraHeight})`
			}, listeners.get(this)), groups.map((nodes, key) => h('g', { key }, nodes))));

			const plotNodes: VNode[] = [];
			for (const nodes of groups) {
				plotNodes.push(...nodes);
			}
			virtualPlotNodes.set(this, plotNodes);

			return nodes;
		}
	})
	.mixin({
		initialize(instance) {
			// FIXME: Can this be done lazily? Perhaps an 'interactive' opt-in option?
			listeners.set(instance, {
				onclick(evt) {
					const { currentTarget } = evt;
					const target = <Node> evt.target;
					if (target === currentTarget) {
						return;
					}

					const path = new Set<Node>();
					for (let node = target; node !== currentTarget; node = node.parentNode) {
						path.add(node);
					}

					const plotNode = find(virtualPlotNodes.get(instance), ({ domNode }) => path.has(domNode));
					instance.emitPlotEvent('select', plotNode, evt);
				}
			});

			virtualPlotNodes.set(instance, []);
		}
	});

export default createColumnChart;
