
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Schedules a callback to run immediately before the component is updated after any state change.
     *
     * The first time the callback runs will be before the initial `onMount`
     *
     * https://svelte.dev/docs#run-time-svelte-beforeupdate
     */
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately after the component has been updated.
     *
     * The first time the callback runs will be after the initial `onMount`
     */
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const cnnStore = writable([]);
    const svgStore = writable(undefined);

    const vSpaceAroundGapStore = writable(undefined);
    const hSpaceAroundGapStore = writable(undefined);

    const nodeCoordinateStore = writable([]);
    const selectedScaleLevelStore = writable(undefined);

    const cnnLayerRangesStore = writable({});
    const cnnLayerMinMaxStore = writable([]);

    const needRedrawStore = writable([undefined, undefined]);

    const detailedModeStore = writable(true);

    const shouldIntermediateAnimateStore = writable(false);

    const isInSoftmaxStore = writable(false);
    const softmaxDetailViewStore = writable({});
    const allowsSoftmaxAnimationStore = writable(false);

    const hoverInfoStore = writable({});

    const modalStore = writable({});

    const intermediateLayerPositionStore = writable({});

    // Enum of node types

    // Helper functions

    /**
     * Create a 2D array (matrix) with given size and default value.
     * 
     * @param {int} height Height (number of rows) for the matrix
     * @param {int} width Width (number of columns) for the matrix
     * @param {int} fill Default value to fill this matrix
     */
    const init2DArray = (height, width, fill) => {
      let array = [];
      // Itereate through rows
      for (let r = 0; r < height; r++) {
        let row = new Array(width).fill(fill);
        array.push(row);
      }
      return array;
    };

    /**
     * Dot product of two matrices.
     * @param {[[number]]} mat1 Matrix 1
     * @param {[[number]]} mat2 Matrix 2
     */
    const matrixDot = (mat1, mat2) => {
      console.assert(mat1.length === mat2.length, 'Dimension not matching');
      console.assert(mat1[0].length === mat2[0].length, 'Dimension not matching');

      let result = 0;
      for (let i = 0; i < mat1.length; i++){
        for (let j = 0; j < mat1[0].length; j++){
          result += mat1[i][j] * mat2[i][j];
        }
      }
      
      return result;
    };

    /**
     * 2D slice on a matrix.
     * @param {[[number]]} mat Matrix
     * @param {int} xs First dimension (row) starting index
     * @param {int} xe First dimension (row) ending index
     * @param {int} ys Second dimension (column) starting index
     * @param {int} ye Second dimension (column) ending index
     */
    const matrixSlice = (mat, xs, xe, ys, ye) => {
      return mat.slice(xs, xe).map(s => s.slice(ys, ye));
    };

    /**
     * Compute the maximum of a matrix.
     * @param {[[number]]} mat Matrix
     */
    const matrixMax = (mat) => {
      let curMax = -Infinity;
      for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[0].length; j++) {
          if (mat[i][j] > curMax) {
            curMax = mat[i][j];
          }
        }
      }
      return curMax;
    };

    /**
     * Compute convolutions of one kernel on one matrix (one slice of a tensor).
     * @param {[[number]]} input Input, square matrix
     * @param {[[number]]} kernel Kernel weights, square matrix
     * @param {int} stride Stride size
     * @param {int} padding Padding size
     */
    const singleConv = (input, kernel, stride=1, padding=0) => {
      // TODO: implement padding

      // Only support square input and kernel
      console.assert(input.length === input[0].length,
         'Conv input is not square');
      console.assert(kernel.length === kernel[0].length,
        'Conv kernel is not square');

      let stepSize = (input.length - kernel.length) / stride + 1;

      let result = init2DArray(stepSize, stepSize, 0);

      // Window sliding
      for (let r = 0; r < stepSize; r++) {
        for (let c = 0; c < stepSize; c++) {
          let curWindow = matrixSlice(input, r * stride, r * stride + kernel.length,
            c * stride, c * stride + kernel.length);
          let dot = matrixDot(curWindow, kernel);
          result[r][c] = dot;
        }
      }
      return result;
    };

    /**
     * Max pool one matrix.
     * @param {[[number]]} mat Matrix
     * @param {int} kernelWidth Pooling kernel length (only supports 2)
     * @param {int} stride Pooling sliding stride (only supports 2)
     * @param {string} padding Pading method when encountering odd number mat,
     * currently this function only supports 'VALID'
     */
    const singleMaxPooling = (mat, kernelWidth=2, stride=2, padding='VALID') => {
      console.assert(kernelWidth === 2, 'Only supports kernen = [2,2]');
      console.assert(stride === 2, 'Only supports stride = 2');
      console.assert(padding === 'VALID', 'Only support valid padding');

      // Handle odd length mat
      // 'VALID': ignore edge rows and columns
      // 'SAME': add zero padding to make the mat have even length
      if (mat.length % 2 === 1 && padding === 'VALID') {
        mat = matrixSlice(mat, 0, mat.length - 1, 0, mat.length - 1);
      }

      let stepSize = (mat.length - kernelWidth) / stride + 1;
      let result = init2DArray(stepSize, stepSize, 0);

      for (let r = 0; r < stepSize; r++) {
        for (let c = 0; c < stepSize; c++) {
          let curWindow = matrixSlice(mat, r * stride, r * stride + kernelWidth,
            c * stride, c * stride + kernelWidth);
          result[r][c] = matrixMax(curWindow);
        }
     }
     return result;
    };

    function array1d(length, f) {
      return Array.from({length: length}, f ? ((v, i) => f(i)) : undefined);
    }

    function array2d(height, width, f) {
      return Array.from({length: height}, (v, i) => Array.from({length: width}, f ? ((w, j) => f(i, j)) : undefined));
    }

    function generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation) {
      const outputMapping = array2d(output.length, output.length, (i, j) => array2d(kernelLength, kernelLength));
      for (let h_out = 0; h_out < output.length; h_out++) {
        for (let w_out = 0; w_out < output.length; w_out++) {
          for (let h_kern = 0; h_kern < kernelLength; h_kern++) {
            for (let w_kern = 0; w_kern < kernelLength; w_kern++) {
              const h_im = h_out * stride + h_kern * dilation;
              const w_im = w_out * stride + w_kern * dilation;
              outputMapping[h_out][w_out][h_kern][w_kern] = h_im * padded_input_size + w_im;
            }
          }
        }
      }
      return outputMapping;
    }

    function compute_input_multiplies_with_weight(hoverH, hoverW, 
                                                  padded_input_size, weight_dims, outputMappings, kernelLength) {
      const input_multiplies_with_weight = array1d(padded_input_size * padded_input_size);
      for (let h_weight = 0; h_weight < kernelLength; h_weight++) {
        for (let w_weight = 0; w_weight < kernelLength; w_weight++) {
          const flat_input = outputMappings[hoverH][hoverW][h_weight][w_weight];
          if (typeof flat_input === "undefined") continue;
          input_multiplies_with_weight[flat_input] = [h_weight, w_weight];
        }
      }
      return input_multiplies_with_weight;
    }

    function getMatrixSliceFromInputHighlights(matrix, highlights, kernelLength) {
      var indices = highlights.reduce((total, value, index) => {
      if (value != undefined) total.push(index);
        return total;
      }, []);
      return matrixSlice(matrix, Math.floor(indices[0] / matrix.length), Math.floor(indices[0] / matrix.length) + kernelLength, indices[0] % matrix.length, indices[0] % matrix.length + kernelLength);
    }

    function getMatrixSliceFromOutputHighlights(matrix, highlights) {
      var indices = highlights.reduce((total, value, index) => {
      if (value != false) total.push(index);
        return total;
      }, []);
      return matrixSlice(matrix, Math.floor(indices[0] / matrix.length), Math.floor(indices[0] / matrix.length) + 1, indices[0] % matrix.length, indices[0] % matrix.length + 1);
    }

    // Edit these values to change size of low-level conv visualization.
    function getVisualizationSizeConstraint(imageLength) {
      let sizeOfGrid = 150;
      let maxSizeOfGridCell = 20;
      return sizeOfGrid / imageLength > maxSizeOfGridCell ? maxSizeOfGridCell : sizeOfGrid / imageLength;
    }

    function getDataRange(image) {
      let maxRow = image.map(function(row){ return Math.max.apply(Math, row); });
      let max = Math.max.apply(null, maxRow);
      let minRow = image.map(function(row){ return Math.min.apply(Math, row); });
      let min = Math.min.apply(null, minRow);
      let range = {
        range: 2 * Math.max(Math.abs(min), Math.abs(max)),
        min: min,
        max: max
      };
      return range;
    }

    function gridData(image, constraint=getVisualizationSizeConstraint(image.length)) {
      // Constrain grids based on input image size.
      var data = new Array();
      var xpos = 1;
      var ypos = 1;
      var width = constraint;
      var height = constraint;
      for (var row = 0; row < image.length; row++) {
        data.push( new Array() );
        for (var column = 0; column < image[0].length; column++) {
          data[row].push({
            text: Math.round(image[row][column] * 100) / 100,
            row: row,
            col: column,
            x: xpos,
            y: ypos,
            width: width,
            height: height
          });
          xpos += width;
        }
        xpos = 1;
        ypos += height; 
      }
      return data;
    }

    /* src\detail-view\Dataview.svelte generated by Svelte v3.59.2 */
    const file = "src\\detail-view\\Dataview.svelte";

    function create_fragment(ctx) {
    	let div;
    	let svg;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg = svg_element("svg");
    			attr_dev(svg, "id", "grid");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			add_location(svg, file, 120, 2, 3989);
    			set_style(div, "display", "inline-block");
    			set_style(div, "vertical-align", "middle");
    			attr_dev(div, "class", "grid");
    			add_location(div, file, 118, 0, 3886);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, svg);
    			/*div_binding*/ ctx[10](div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[10](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const textConstraintDivisor = 2.6;
    const standardCellColor = "ddd";

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dataview', slots, []);
    	let { data } = $$props;
    	let { highlights } = $$props;
    	let { isKernelMath } = $$props;
    	let { constraint } = $$props;
    	let { dataRange } = $$props;
    	let { outputLength = undefined } = $$props;
    	let { stride = undefined } = $$props;
    	let { colorScale = d3.interpolateRdBu } = $$props;
    	let { isInputLayer = false } = $$props;
    	let grid_final;
    	const dispatch = createEventDispatcher();
    	let oldHighlight = highlights;
    	let oldData = data;

    	const redraw = () => {
    		d3.select(grid_final).selectAll("#grid > *").remove();
    		const constrainedSvgSize = data.length * constraint + 2;
    		var grid = d3.select(grid_final).select("#grid").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px").append("svg").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px");
    		var row = grid.selectAll(".row").data(data).enter().append("g").attr("class", "row");

    		var column = row.selectAll(".square").data(function (d) {
    			return d;
    		}).enter().append("rect").attr("class", "square").attr("x", function (d) {
    			return d.x;
    		}).attr("y", function (d) {
    			return d.y;
    		}).attr("width", function (d) {
    			return d.width;
    		}).attr("height", function (d) {
    			return d.height;
    		}).style("opacity", 0.8).style("fill", function (d) {
    			let normalizedValue = d.text;

    			if (isInputLayer) {
    				normalizedValue = 1 - d.text;
    			} else {
    				normalizedValue = (d.text + dataRange / 2) / dataRange;
    			}

    			return colorScale(normalizedValue);
    		}).on('mouseover', function (d) {
    			if (data.length != outputLength) {
    				dispatch('message', {
    					hoverH: Math.min(Math.floor(d.row / stride), outputLength - 1),
    					hoverW: Math.min(Math.floor(d.col / stride), outputLength - 1)
    				});
    			} else {
    				dispatch('message', {
    					hoverH: Math.min(Math.floor(d.row / 1), outputLength - 1),
    					hoverW: Math.min(Math.floor(d.col / 1), outputLength - 1)
    				});
    			}
    		});

    		if (isKernelMath) {
    			var text = row.selectAll(".text").data(function (d) {
    				return d;
    			}).enter().append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor) + "px").attr("x", function (d) {
    				return d.x + d.width / 2;
    			}).attr("y", function (d) {
    				return d.y + d.height / 2;
    			}).style("fill", function (d) {
    				let normalizedValue = d.text;

    				if (isInputLayer) {
    					normalizedValue = 1 - d.text;
    				} else {
    					normalizedValue = (d.text + dataRange / 2) / dataRange;
    				}

    				if (normalizedValue < 0.2 || normalizedValue > 0.8) {
    					return 'white';
    				} else {
    					return 'black';
    				}
    			}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    				return d.text.toString().replace('-', '－');
    			});
    		}
    	};

    	afterUpdate(() => {
    		if (data != oldData) {
    			redraw();
    			oldData = data;
    		}

    		if (highlights != oldHighlight) {
    			var grid = d3.select(grid_final).select('#grid').select("svg");

    			grid.selectAll(".square").style("stroke", d => isKernelMath || highlights.length && highlights[d.row * data.length + d.col]
    			? "black"
    			: null);

    			oldHighlight = highlights;
    		}
    	});

    	onMount(() => {
    		redraw();
    	});

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<Dataview> was created without expected prop 'data'");
    		}

    		if (highlights === undefined && !('highlights' in $$props || $$self.$$.bound[$$self.$$.props['highlights']])) {
    			console.warn("<Dataview> was created without expected prop 'highlights'");
    		}

    		if (isKernelMath === undefined && !('isKernelMath' in $$props || $$self.$$.bound[$$self.$$.props['isKernelMath']])) {
    			console.warn("<Dataview> was created without expected prop 'isKernelMath'");
    		}

    		if (constraint === undefined && !('constraint' in $$props || $$self.$$.bound[$$self.$$.props['constraint']])) {
    			console.warn("<Dataview> was created without expected prop 'constraint'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<Dataview> was created without expected prop 'dataRange'");
    		}
    	});

    	const writable_props = [
    		'data',
    		'highlights',
    		'isKernelMath',
    		'constraint',
    		'dataRange',
    		'outputLength',
    		'stride',
    		'colorScale',
    		'isInputLayer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Dataview> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			grid_final = $$value;
    			$$invalidate(0, grid_final);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('highlights' in $$props) $$invalidate(2, highlights = $$props.highlights);
    		if ('isKernelMath' in $$props) $$invalidate(3, isKernelMath = $$props.isKernelMath);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('outputLength' in $$props) $$invalidate(6, outputLength = $$props.outputLength);
    		if ('stride' in $$props) $$invalidate(7, stride = $$props.stride);
    		if ('colorScale' in $$props) $$invalidate(8, colorScale = $$props.colorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    	};

    	$$self.$capture_state = () => ({
    		data,
    		highlights,
    		isKernelMath,
    		constraint,
    		dataRange,
    		outputLength,
    		stride,
    		colorScale,
    		isInputLayer,
    		onMount,
    		onDestroy,
    		beforeUpdate,
    		afterUpdate,
    		createEventDispatcher,
    		grid_final,
    		textConstraintDivisor,
    		standardCellColor,
    		dispatch,
    		oldHighlight,
    		oldData,
    		redraw
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('highlights' in $$props) $$invalidate(2, highlights = $$props.highlights);
    		if ('isKernelMath' in $$props) $$invalidate(3, isKernelMath = $$props.isKernelMath);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('outputLength' in $$props) $$invalidate(6, outputLength = $$props.outputLength);
    		if ('stride' in $$props) $$invalidate(7, stride = $$props.stride);
    		if ('colorScale' in $$props) $$invalidate(8, colorScale = $$props.colorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    		if ('grid_final' in $$props) $$invalidate(0, grid_final = $$props.grid_final);
    		if ('oldHighlight' in $$props) oldHighlight = $$props.oldHighlight;
    		if ('oldData' in $$props) oldData = $$props.oldData;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		grid_final,
    		data,
    		highlights,
    		isKernelMath,
    		constraint,
    		dataRange,
    		outputLength,
    		stride,
    		colorScale,
    		isInputLayer,
    		div_binding
    	];
    }

    class Dataview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			data: 1,
    			highlights: 2,
    			isKernelMath: 3,
    			constraint: 4,
    			dataRange: 5,
    			outputLength: 6,
    			stride: 7,
    			colorScale: 8,
    			isInputLayer: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dataview",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get data() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get highlights() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set highlights(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isKernelMath() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isKernelMath(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get constraint() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set constraint(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get outputLength() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set outputLength(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get stride() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stride(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputLayer() {
    		throw new Error("<Dataview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputLayer(value) {
    		throw new Error("<Dataview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\KernelMathView.svelte generated by Svelte v3.59.2 */
    const file$1 = "src\\detail-view\\KernelMathView.svelte";

    function create_fragment$1(ctx) {
    	let div0;
    	let t;
    	let div1;
    	let svg_1;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			svg_1 = svg_element("svg");
    			attr_dev(div0, "class", "legend");
    			add_location(div0, file$1, 282, 0, 10824);
    			attr_dev(svg_1, "id", "grid");
    			attr_dev(svg_1, "width", "100%");
    			attr_dev(svg_1, "height", "100%");
    			add_location(svg_1, file$1, 289, 2, 10989);
    			attr_dev(div1, "class", "grid");
    			add_location(div1, file$1, 287, 0, 10942);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			/*div0_binding*/ ctx[10](div0);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, svg_1);
    			/*div1_binding*/ ctx[11](div1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			/*div0_binding*/ ctx[10](null);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div1);
    			/*div1_binding*/ ctx[11](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const textConstraintDivisor$1 = 2.6;

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('KernelMathView', slots, []);
    	let { data } = $$props;
    	let { kernel } = $$props;
    	let { constraint } = $$props;
    	let { dataRange } = $$props;
    	let { kernelRange } = $$props;
    	let { colorScale = d3.interpolateRdBu } = $$props;
    	let { kernelColorScale = d3.interpolateBrBG } = $$props;
    	let { isInputLayer = false } = $$props;
    	let gridFinal;
    	let legendFinal;
    	const multiplicationSymbolPadding = Math.floor(constraint / 3);
    	let oldData = data;
    	let oldKernel = kernel;

    	// Legend drawn similarly to legends in overview/intermediate-view.
    	const addOverlayGradient = (gradientID, stops, group) => {
    		if (group === undefined) {
    			group = svg;
    		}

    		// Create a gradient
    		let defs = group.append("defs").attr('class', 'overlay-gradient');

    		let gradient = defs.append("linearGradient").attr("id", gradientID).attr("x1", "0%").attr("x2", "100%").attr("y1", "100%").attr("y2", "100%");

    		stops.forEach(s => {
    			gradient.append('stop').attr('offset', s.offset).attr('stop-color', s.color).attr('stop-opacity', s.opacity);
    		});
    	};

    	// Draw the legend for intermediate layer
    	const redrawDetailedConvViewLegend = arg => {
    		let legendHeight = arg.legendHeight,
    			range = arg.range,
    			minMax = arg.minMax,
    			width = arg.width,
    			colorScale = arg.colorScale,
    			gradientGap = arg.gradientGap;

    		d3.select(legendFinal).selectAll("#legend > *").remove();
    		let legend = d3.select(legendFinal).select("#legend").attr("width", 150 + "px").attr("height", 25 + "px").attr("align", "center").style("dominant-baseline", "middle");
    		let detailedViewKernel = legend.append('g').attr('transform', `translate(10, 0)`);

    		if (colorScale === undefined) {
    			colorScale = layerColorScales.conv;
    		}

    		if (gradientGap === undefined) {
    			gradientGap = 0;
    		}

    		// Add a legend color gradient
    		let gradientName = `url(#detailed-kernel-gradient)`;

    		let normalizedColor = v => colorScale(v * (1 - 2 * gradientGap) + gradientGap);

    		let leftValue = (minMax.min + range / 2) / range,
    			zeroValue = (0 + range / 2) / range,
    			rightValue = (minMax.max + range / 2) / range,
    			totalRange = minMax.max - minMax.min,
    			zeroLocation = (0 - minMax.min) / totalRange,
    			leftMidValue = leftValue + (zeroValue - leftValue) / 2,
    			rightMidValue = zeroValue + (rightValue - zeroValue) / 2;

    		let stops = [
    			{
    				offset: 0,
    				color: normalizedColor(leftValue),
    				opacity: 1
    			},
    			{
    				offset: zeroLocation / 2,
    				color: normalizedColor(leftMidValue),
    				opacity: 1
    			},
    			{
    				offset: zeroLocation,
    				color: normalizedColor(zeroValue),
    				opacity: 1
    			},
    			{
    				offset: zeroLocation + (1 - zeroValue) / 2,
    				color: normalizedColor(rightMidValue),
    				opacity: 1
    			},
    			{
    				offset: 1,
    				color: normalizedColor(rightValue),
    				opacity: 1
    			}
    		];

    		addOverlayGradient(`detailed-kernel-gradient`, stops, detailedViewKernel);
    		let legendScale = d3.scaleLinear().range([0, width - 1.2]).domain([minMax.min, minMax.max]);
    		let legendAxis = d3.axisBottom().scale(legendScale).tickFormat(d3.format('.2f')).tickValues([minMax.min, 0, minMax.max]);
    		let detailedLegend = detailedViewKernel.append('g').attr('id', `detailed-legend-0`);
    		let legendGroup = detailedLegend.append('g').attr('transform', `translate(0, ${legendHeight - 3})`).call(legendAxis);
    		legendGroup.selectAll('text').style('font-size', '9px').style('fill', "black");
    		legendGroup.selectAll('path, line').style('stroke', "black");
    		detailedLegend.append('rect').attr('width', width).attr('height', legendHeight).style('fill', gradientName);
    	};

    	// Draw the elementwise dot-product math.
    	const redraw = () => {
    		d3.select(gridFinal).selectAll("#grid > *").remove();

    		const constrainedSvgSize = kernel
    		? 2 * (data.length * constraint) + 2
    		: data.length * constraint + 2;

    		var grid = d3.select(gridFinal).select("#grid").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px").append("svg").attr("width", constrainedSvgSize + "px").attr("height", constrainedSvgSize + "px");
    		var row = grid.selectAll(".row").data(data).enter().append("g").attr("class", "row");

    		var columns = row.selectAll(".square").data(function (d) {
    			return d;
    		}).enter();

    		// Draw cells for slice from input matrix.
    		columns.append("rect").attr("class", "square").attr("x", function (d) {
    			return d.x === 1
    			? d.x + multiplicationSymbolPadding
    			: d.x * 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y : d.y * 2;
    		}).attr("width", function (d) {
    			return d.width;
    		}).attr("height", function (d) {
    			return d.height;
    		}).style("opacity", 0.5).style("fill", function (d) {
    			let normalizedValue = d.text;

    			if (isInputLayer) {
    				normalizedValue = 1 - d.text;
    			} else {
    				normalizedValue = (d.text + dataRange / 2) / dataRange;
    			}

    			return colorScale(normalizedValue);
    		}).style("stroke", "black");

    		// Draw cells for the kernel.
    		columns.append("rect").attr("class", "square").attr("x", function (d) {
    			return d.x === 1
    			? d.x + multiplicationSymbolPadding
    			: d.x * 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y + d.height : d.y * 2 + d.height;
    		}).attr("width", function (d) {
    			return d.width;
    		}).attr("height", function (d) {
    			return d.height / 2;
    		}).style("opacity", 0.5).// Same colorscale as is used for the flatten layers.
    		style("fill", function (d) {
    			let normalizedValue = (kernel[d.row][d.col].text + kernelRange.range / 2) / kernelRange.range;
    			const gap = 0.2;
    			let normalizedValueWithGap = normalizedValue * (1 - 2 * gap) + gap;
    			return kernelColorScale(normalizedValueWithGap);
    		});

    		var texts = row.selectAll(".text").data(function (d) {
    			return d;
    		}).enter();

    		// Draw numbers from input matrix slice.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor$1) + "px").attr("x", function (d) {
    			return d.x === 1
    			? d.x + d.width / 2 + multiplicationSymbolPadding
    			: d.x * 2 + d.width / 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y + d.height / 2 : d.y * 2 + d.height / 2;
    		}).style("fill", function (d) {
    			let normalizedValue = d.text;

    			if (isInputLayer) {
    				normalizedValue = 1 - d.text;
    			} else {
    				normalizedValue = (d.text + dataRange / 2) / dataRange;
    			}

    			if (normalizedValue < 0.2 || normalizedValue > 0.8) {
    				if (isInputLayer && normalizedValue < 0.2) {
    					return 'black';
    				}

    				return 'white';
    			} else {
    				return 'black';
    			}
    		}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return d.text;
    		});

    		// Attempted to use FontAwesome icons for the 'x', '+', and '=', but none of these strategies work: https://github.com/FortAwesome/Font-Awesome/issues/12268
    		// Draw 'x' to signify multiplication.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor$1) + "px").attr('font-weight', 600).attr("x", function (d) {
    			return d.x === 1
    			? d.x + multiplicationSymbolPadding / 2
    			: d.x * 2 + multiplicationSymbolPadding / 2;
    		}).attr("y", function (d) {
    			return d.y === 1
    			? d.y + d.height + d.height / 4
    			: d.y * 2 + d.height + d.height / 4;
    		}).style("fill", "black").style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return '×';
    		});

    		// Draw kernel values.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / textConstraintDivisor$1) + "px").attr("x", function (d) {
    			return d.x === 1
    			? d.x + d.width / 2 + multiplicationSymbolPadding
    			: d.x * 2 + d.width / 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1
    			? d.y + d.height + d.height / 4
    			: d.y * 2 + d.height + d.height / 4;
    		}).style("fill", function (d) {
    			let normalizedValue = (kernel[d.row][d.col].text + kernelRange.range / 2) / kernelRange.range;
    			const gap = 0.2;
    			let normalizedValueWithGap = normalizedValue * (1 - 2 * gap) + gap;

    			if (normalizedValueWithGap < 0.2 || normalizedValueWithGap > 0.8) {
    				return 'white';
    			} else {
    				return 'black';
    			}
    		}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return kernel[d.row][d.col].text;
    		});

    		// Draw '+' to signify the summing of products except for the last kernel cell where '=' is drawn.
    		texts.append("text").attr("class", "text").style("font-size", Math.floor(constraint / (textConstraintDivisor$1 - 1)) + "px").attr("x", function (d) {
    			return d.x === 1
    			? d.x + d.width + d.width / 2 + multiplicationSymbolPadding
    			: d.x * 2 + d.width + d.width / 2 + multiplicationSymbolPadding;
    		}).attr("y", function (d) {
    			return d.y === 1 ? d.y + d.height / 2 : d.y * 2 + d.height / 2;
    		}).style("text-anchor", "middle").style("dominant-baseline", "middle").text(function (d) {
    			return d.row == kernel.length - 1 && d.col == kernel.length - 1
    			? '='
    			: '+';
    		});
    	};

    	afterUpdate(() => {
    		if (data != oldData) {
    			redraw();
    			oldData = data;
    		}

    		if (kernel != oldKernel) {
    			/*
    redrawDetailedConvViewLegend({
        legendHeight: 5,
        range: kernelRange.range,
        minMax: {min: kernelRange.min, max: kernelRange.max},
        width: 130,
        colorScale: kernelColorScale,
        gradientGap: 0.35,
    });
    */
    			oldKernel = kernel;
    		}
    	});

    	onMount(() => {
    		redraw();
    	}); /*
    redrawDetailedConvViewLegend({
          legendHeight: 5,
          range: kernelRange.range,
          minMax: {min: kernelRange.min, max: kernelRange.max},
          width: 130,
          colorScale: kernelColorScale,
          gradientGap: 0.35,
    });
    */

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<KernelMathView> was created without expected prop 'data'");
    		}

    		if (kernel === undefined && !('kernel' in $$props || $$self.$$.bound[$$self.$$.props['kernel']])) {
    			console.warn("<KernelMathView> was created without expected prop 'kernel'");
    		}

    		if (constraint === undefined && !('constraint' in $$props || $$self.$$.bound[$$self.$$.props['constraint']])) {
    			console.warn("<KernelMathView> was created without expected prop 'constraint'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<KernelMathView> was created without expected prop 'dataRange'");
    		}

    		if (kernelRange === undefined && !('kernelRange' in $$props || $$self.$$.bound[$$self.$$.props['kernelRange']])) {
    			console.warn("<KernelMathView> was created without expected prop 'kernelRange'");
    		}
    	});

    	const writable_props = [
    		'data',
    		'kernel',
    		'constraint',
    		'dataRange',
    		'kernelRange',
    		'colorScale',
    		'kernelColorScale',
    		'isInputLayer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<KernelMathView> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			legendFinal = $$value;
    			$$invalidate(1, legendFinal);
    		});
    	}

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			gridFinal = $$value;
    			$$invalidate(0, gridFinal);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('kernel' in $$props) $$invalidate(3, kernel = $$props.kernel);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('kernelRange' in $$props) $$invalidate(6, kernelRange = $$props.kernelRange);
    		if ('colorScale' in $$props) $$invalidate(7, colorScale = $$props.colorScale);
    		if ('kernelColorScale' in $$props) $$invalidate(8, kernelColorScale = $$props.kernelColorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    	};

    	$$self.$capture_state = () => ({
    		data,
    		kernel,
    		constraint,
    		dataRange,
    		kernelRange,
    		colorScale,
    		kernelColorScale,
    		isInputLayer,
    		onMount,
    		afterUpdate,
    		gridFinal,
    		legendFinal,
    		textConstraintDivisor: textConstraintDivisor$1,
    		multiplicationSymbolPadding,
    		oldData,
    		oldKernel,
    		addOverlayGradient,
    		redrawDetailedConvViewLegend,
    		redraw
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('kernel' in $$props) $$invalidate(3, kernel = $$props.kernel);
    		if ('constraint' in $$props) $$invalidate(4, constraint = $$props.constraint);
    		if ('dataRange' in $$props) $$invalidate(5, dataRange = $$props.dataRange);
    		if ('kernelRange' in $$props) $$invalidate(6, kernelRange = $$props.kernelRange);
    		if ('colorScale' in $$props) $$invalidate(7, colorScale = $$props.colorScale);
    		if ('kernelColorScale' in $$props) $$invalidate(8, kernelColorScale = $$props.kernelColorScale);
    		if ('isInputLayer' in $$props) $$invalidate(9, isInputLayer = $$props.isInputLayer);
    		if ('gridFinal' in $$props) $$invalidate(0, gridFinal = $$props.gridFinal);
    		if ('legendFinal' in $$props) $$invalidate(1, legendFinal = $$props.legendFinal);
    		if ('oldData' in $$props) oldData = $$props.oldData;
    		if ('oldKernel' in $$props) oldKernel = $$props.oldKernel;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		gridFinal,
    		legendFinal,
    		data,
    		kernel,
    		constraint,
    		dataRange,
    		kernelRange,
    		colorScale,
    		kernelColorScale,
    		isInputLayer,
    		div0_binding,
    		div1_binding
    	];
    }

    class KernelMathView extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			data: 2,
    			kernel: 3,
    			constraint: 4,
    			dataRange: 5,
    			kernelRange: 6,
    			colorScale: 7,
    			kernelColorScale: 8,
    			isInputLayer: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "KernelMathView",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get data() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernel() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernel(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get constraint() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set constraint(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelRange() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelRange(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelColorScale() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelColorScale(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputLayer() {
    		throw new Error("<KernelMathView>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputLayer(value) {
    		throw new Error("<KernelMathView>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\ConvolutionAnimator.svelte generated by Svelte v3.59.2 */
    const file$2 = "src\\detail-view\\ConvolutionAnimator.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*image*/ ctx[2].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*image*/ ctx[2][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div2;
    	let kernelmathview;
    	let t7;
    	let dataview1;
    	let t8;
    	let div4;
    	let div3;
    	let t9;
    	let t10_value = /*output*/ ctx[3].length + "";
    	let t10;
    	let t11;
    	let t12_value = /*output*/ ctx[3][0].length + "";
    	let t12;
    	let t13;
    	let t14;
    	let dataview2;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*testImage*/ ctx[11],
    				highlights: /*inputHighlights*/ ctx[7],
    				outputLength: /*output*/ ctx[3].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[2].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0],
    				colorScale: /*colorScale*/ ctx[5],
    				isInputLayer: /*isInputInputLayer*/ ctx[6]
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[14]);

    	kernelmathview = new KernelMathView({
    			props: {
    				data: /*testInputMatrixSlice*/ ctx[9],
    				kernel: /*testKernel*/ ctx[13],
    				constraint: getVisualizationSizeConstraint(/*kernel*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[4],
    				kernelRange: getDataRange(/*kernel*/ ctx[1]),
    				colorScale: /*colorScale*/ ctx[5],
    				isInputLayer: /*isInputInputLayer*/ ctx[6]
    			},
    			$$inline: true
    		});

    	dataview1 = new Dataview({
    			props: {
    				data: /*testOutputMatrixSlice*/ ctx[10],
    				highlights: /*outputHighlights*/ ctx[8],
    				isKernelMath: true,
    				constraint: getVisualizationSizeConstraint(/*kernel*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[4]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*testOutput*/ ctx[12],
    				highlights: /*outputHighlights*/ ctx[8],
    				isKernelMath: false,
    				outputLength: /*output*/ ctx[3].length,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[3].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0]
    			},
    			$$inline: true
    		});

    	dataview2.$on("message", /*handleMouseover*/ ctx[14]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			create_component(kernelmathview.$$.fragment);
    			t7 = space();
    			create_component(dataview1.$$.fragment);
    			t8 = space();
    			div4 = element("div");
    			div3 = element("div");
    			t9 = text("Output (");
    			t10 = text(t10_value);
    			t11 = text(", ");
    			t12 = text(t12_value);
    			t13 = text(")");
    			t14 = space();
    			create_component(dataview2.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$2, 106, 2, 4124);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$2, 105, 0, 4082);
    			attr_dev(div2, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div2, file$2, 114, 0, 4530);
    			attr_dev(div3, "class", "header-text");
    			add_location(div3, file$2, 122, 2, 5083);
    			attr_dev(div4, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div4, file$2, 121, 0, 5041);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			mount_component(kernelmathview, div2, null);
    			append_dev(div2, t7);
    			mount_component(dataview1, div2, null);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, t9);
    			append_dev(div3, t10);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div3, t13);
    			append_dev(div4, t14);
    			mount_component(dataview2, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*image*/ 4) && t1_value !== (t1_value = /*image*/ ctx[2].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*image*/ 4) && t3_value !== (t3_value = /*image*/ ctx[2][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*testImage*/ 2048) dataview0_changes.data = /*testImage*/ ctx[11];
    			if (dirty & /*inputHighlights*/ 128) dataview0_changes.highlights = /*inputHighlights*/ ctx[7];
    			if (dirty & /*output*/ 8) dataview0_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*image*/ 4) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[2].length);
    			if (dirty & /*dataRange*/ 16) dataview0_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview0_changes.stride = /*stride*/ ctx[0];
    			if (dirty & /*colorScale*/ 32) dataview0_changes.colorScale = /*colorScale*/ ctx[5];
    			if (dirty & /*isInputInputLayer*/ 64) dataview0_changes.isInputLayer = /*isInputInputLayer*/ ctx[6];
    			dataview0.$set(dataview0_changes);
    			const kernelmathview_changes = {};
    			if (dirty & /*testInputMatrixSlice*/ 512) kernelmathview_changes.data = /*testInputMatrixSlice*/ ctx[9];
    			if (dirty & /*testKernel*/ 8192) kernelmathview_changes.kernel = /*testKernel*/ ctx[13];
    			if (dirty & /*kernel*/ 2) kernelmathview_changes.constraint = getVisualizationSizeConstraint(/*kernel*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 16) kernelmathview_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*kernel*/ 2) kernelmathview_changes.kernelRange = getDataRange(/*kernel*/ ctx[1]);
    			if (dirty & /*colorScale*/ 32) kernelmathview_changes.colorScale = /*colorScale*/ ctx[5];
    			if (dirty & /*isInputInputLayer*/ 64) kernelmathview_changes.isInputLayer = /*isInputInputLayer*/ ctx[6];
    			kernelmathview.$set(kernelmathview_changes);
    			const dataview1_changes = {};
    			if (dirty & /*testOutputMatrixSlice*/ 1024) dataview1_changes.data = /*testOutputMatrixSlice*/ ctx[10];
    			if (dirty & /*outputHighlights*/ 256) dataview1_changes.highlights = /*outputHighlights*/ ctx[8];
    			if (dirty & /*kernel*/ 2) dataview1_changes.constraint = getVisualizationSizeConstraint(/*kernel*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 16) dataview1_changes.dataRange = /*dataRange*/ ctx[4];
    			dataview1.$set(dataview1_changes);
    			if ((!current || dirty & /*output*/ 8) && t10_value !== (t10_value = /*output*/ ctx[3].length + "")) set_data_dev(t10, t10_value);
    			if ((!current || dirty & /*output*/ 8) && t12_value !== (t12_value = /*output*/ ctx[3][0].length + "")) set_data_dev(t12, t12_value);
    			const dataview2_changes = {};
    			if (dirty & /*testOutput*/ 4096) dataview2_changes.data = /*testOutput*/ ctx[12];
    			if (dirty & /*outputHighlights*/ 256) dataview2_changes.highlights = /*outputHighlights*/ ctx[8];
    			if (dirty & /*output*/ 8) dataview2_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*output*/ 8) dataview2_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[3].length);
    			if (dirty & /*dataRange*/ 16) dataview2_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview2_changes.stride = /*stride*/ ctx[0];
    			dataview2.$set(dataview2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(kernelmathview.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(kernelmathview.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			destroy_component(kernelmathview);
    			destroy_component(dataview1);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(div4);
    			destroy_component(dataview2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding = 0;

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ConvolutionAnimator', slots, []);
    	let { stride } = $$props;
    	let { dilation } = $$props;
    	let { kernel } = $$props;
    	let { image } = $$props;
    	let { output } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	let { colorScale } = $$props;
    	let { isInputInputLayer = false } = $$props;
    	const dispatch = createEventDispatcher();
    	let padded_input_size = image.length + padding * 2;

    	// Dummy data for original state of component.
    	let testInputMatrixSlice = [];

    	for (let i = 0; i < kernel.length; i++) {
    		testInputMatrixSlice.push([]);

    		for (let j = 0; j < kernel.length; j++) {
    			testInputMatrixSlice[i].push(0);
    		}
    	}

    	testInputMatrixSlice = gridData(testInputMatrixSlice);
    	let testOutputMatrixSlice = gridData([0]);
    	let inputHighlights = [];
    	let outputHighlights = array1d(output.length * output.length, i => true);
    	let interval;
    	let counter;

    	// lots of replication between mouseover and start-conv. TODO: fix this.
    	function startConvolution(stride) {
    		counter = 0;
    		let outputMappings = generateOutputMappings(stride, output, kernel.length, padded_input_size, dilation);
    		if (stride <= 0) return;
    		if (interval) clearInterval(interval);

    		$$invalidate(17, interval = setInterval(
    			() => {
    				if (isPaused) return;
    				const flat_animated = counter % (output.length * output.length);
    				$$invalidate(8, outputHighlights = array1d(output.length * output.length, i => false));
    				const animatedH = Math.floor(flat_animated / output.length);
    				const animatedW = flat_animated % output.length;
    				$$invalidate(8, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    				$$invalidate(7, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernel.length, outputMappings, kernel.length));
    				const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernel.length);
    				$$invalidate(9, testInputMatrixSlice = gridData(inputMatrixSlice));
    				const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    				$$invalidate(10, testOutputMatrixSlice = gridData(outputMatrixSlice));
    				counter++;
    			},
    			250
    		));
    	}

    	function handleMouseover(event) {
    		let outputMappings = generateOutputMappings(stride, output, kernel.length, padded_input_size, dilation);
    		$$invalidate(8, outputHighlights = array1d(output.length * output.length, i => false));
    		const animatedH = event.detail.hoverH;
    		const animatedW = event.detail.hoverW;
    		$$invalidate(8, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    		$$invalidate(7, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernel.length, outputMappings, kernel.length));
    		const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernel.length);
    		$$invalidate(9, testInputMatrixSlice = gridData(inputMatrixSlice));
    		const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    		$$invalidate(10, testOutputMatrixSlice = gridData(outputMatrixSlice));
    		$$invalidate(15, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startConvolution(stride);
    	let testImage = gridData(image);
    	let testOutput = gridData(output);
    	let testKernel = gridData(kernel);

    	$$self.$$.on_mount.push(function () {
    		if (stride === undefined && !('stride' in $$props || $$self.$$.bound[$$self.$$.props['stride']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'stride'");
    		}

    		if (dilation === undefined && !('dilation' in $$props || $$self.$$.bound[$$self.$$.props['dilation']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'dilation'");
    		}

    		if (kernel === undefined && !('kernel' in $$props || $$self.$$.bound[$$self.$$.props['kernel']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'kernel'");
    		}

    		if (image === undefined && !('image' in $$props || $$self.$$.bound[$$self.$$.props['image']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'image'");
    		}

    		if (output === undefined && !('output' in $$props || $$self.$$.bound[$$self.$$.props['output']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'output'");
    		}

    		if (isPaused === undefined && !('isPaused' in $$props || $$self.$$.bound[$$self.$$.props['isPaused']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'isPaused'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'dataRange'");
    		}

    		if (colorScale === undefined && !('colorScale' in $$props || $$self.$$.bound[$$self.$$.props['colorScale']])) {
    			console.warn("<ConvolutionAnimator> was created without expected prop 'colorScale'");
    		}
    	});

    	const writable_props = [
    		'stride',
    		'dilation',
    		'kernel',
    		'image',
    		'output',
    		'isPaused',
    		'dataRange',
    		'colorScale',
    		'isInputInputLayer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ConvolutionAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(16, dilation = $$props.dilation);
    		if ('kernel' in $$props) $$invalidate(1, kernel = $$props.kernel);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(15, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(5, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(6, isInputInputLayer = $$props.isInputInputLayer);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getMatrixSliceFromOutputHighlights,
    		compute_input_multiplies_with_weight,
    		getDataRange,
    		getVisualizationSizeConstraint,
    		generateOutputMappings,
    		getMatrixSliceFromInputHighlights,
    		gridData,
    		Dataview,
    		KernelMathView,
    		stride,
    		dilation,
    		kernel,
    		image,
    		output,
    		isPaused,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		dispatch,
    		padding,
    		padded_input_size,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		inputHighlights,
    		outputHighlights,
    		interval,
    		counter,
    		startConvolution,
    		handleMouseover,
    		testImage,
    		testOutput,
    		testKernel
    	});

    	$$self.$inject_state = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(16, dilation = $$props.dilation);
    		if ('kernel' in $$props) $$invalidate(1, kernel = $$props.kernel);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(15, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(5, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(6, isInputInputLayer = $$props.isInputInputLayer);
    		if ('padded_input_size' in $$props) padded_input_size = $$props.padded_input_size;
    		if ('testInputMatrixSlice' in $$props) $$invalidate(9, testInputMatrixSlice = $$props.testInputMatrixSlice);
    		if ('testOutputMatrixSlice' in $$props) $$invalidate(10, testOutputMatrixSlice = $$props.testOutputMatrixSlice);
    		if ('inputHighlights' in $$props) $$invalidate(7, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(8, outputHighlights = $$props.outputHighlights);
    		if ('interval' in $$props) $$invalidate(17, interval = $$props.interval);
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('testImage' in $$props) $$invalidate(11, testImage = $$props.testImage);
    		if ('testOutput' in $$props) $$invalidate(12, testOutput = $$props.testOutput);
    		if ('testKernel' in $$props) $$invalidate(13, testKernel = $$props.testKernel);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 4) {
    			 padded_input_size = image.length + padding * 2;
    		}

    		if ($$self.$$.dirty & /*output*/ 8) {
    			 {
    				let outputHighlights = array1d(output.length * output.length, i => true);
    			}
    		}

    		if ($$self.$$.dirty & /*stride, image, output, kernel*/ 15) {
    			 {
    				startConvolution(stride);
    				$$invalidate(11, testImage = gridData(image));
    				$$invalidate(12, testOutput = gridData(output));
    				$$invalidate(13, testKernel = gridData(kernel));
    			}
    		}
    	};

    	return [
    		stride,
    		kernel,
    		image,
    		output,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		inputHighlights,
    		outputHighlights,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		testImage,
    		testOutput,
    		testKernel,
    		handleMouseover,
    		isPaused,
    		dilation,
    		interval
    	];
    }

    class ConvolutionAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			stride: 0,
    			dilation: 16,
    			kernel: 1,
    			image: 2,
    			output: 3,
    			isPaused: 15,
    			dataRange: 4,
    			colorScale: 5,
    			isInputInputLayer: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ConvolutionAnimator",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get stride() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stride(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dilation() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dilation(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernel() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernel(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputInputLayer() {
    		throw new Error("<ConvolutionAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputInputLayer(value) {
    		throw new Error("<ConvolutionAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Convolutionview.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file$3 = "src\\detail-view\\Convolutionview.svelte";

    // (117:0) {#if !isExited}
    function create_if_block(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[6]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let convolutionanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	convolutionanimator = new ConvolutionAnimator({
    			props: {
    				kernel: /*kernel*/ ctx[2],
    				image: /*input*/ ctx[1],
    				output: /*outputFinal*/ ctx[7],
    				stride: /*stride*/ ctx[8],
    				dilation,
    				isPaused: /*isPaused*/ ctx[6],
    				dataRange: /*dataRange*/ ctx[3],
    				colorScale: /*colorScale*/ ctx[4],
    				isInputInputLayer: /*isInputInputLayer*/ ctx[5]
    			},
    			$$inline: true
    		});

    	convolutionanimator.$on("message", /*handlePauseFromInteraction*/ ctx[10]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "Convolution";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(convolutionanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to change kernel position.");
    			attr_dev(div0, "class", "title-text svelte-1j8mhv0");
    			add_location(div0, file$3, 139, 8, 3136);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$3, 150, 12, 3500);
    			attr_dev(div1, "class", "control-button svelte-1j8mhv0");
    			attr_dev(div1, "role", "button");
    			attr_dev(div1, "tabindex", "0");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$3, 144, 10, 3244);
    			attr_dev(div2, "class", "play-button control-button svelte-1j8mhv0");
    			attr_dev(div2, "role", "button");
    			attr_dev(div2, "tabindex", "0");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$3, 153, 10, 3566);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$3, 170, 12, 4252);
    			attr_dev(div3, "class", "delete-button control-button svelte-1j8mhv0");
    			attr_dev(div3, "role", "button");
    			attr_dev(div3, "tabindex", "0");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$3, 164, 10, 4000);
    			attr_dev(div4, "class", "buttons svelte-1j8mhv0");
    			add_location(div4, file$3, 143, 8, 3211);
    			attr_dev(div5, "class", "control-pannel svelte-1j8mhv0");
    			add_location(div5, file$3, 137, 6, 3096);
    			attr_dev(div6, "class", "container is-centered svelte-1j8mhv0");
    			add_location(div6, file$3, 175, 6, 4358);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-1j8mhv0");
    			add_location(img, file$3, 184, 8, 4761);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$3, 186, 10, 4876);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$3, 185, 8, 4835);
    			attr_dev(div8, "class", "annotation svelte-1j8mhv0");
    			add_location(div8, file$3, 183, 6, 4727);
    			attr_dev(div9, "class", "box svelte-1j8mhv0");
    			add_location(div9, file$3, 135, 4, 3069);
    			attr_dev(div10, "class", "container svelte-1j8mhv0");
    			attr_dev(div10, "id", "detailview-container");
    			add_location(div10, file$3, 117, 2, 2467);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(convolutionanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", handleScroll, false, false, false, false),
    					listen_dev(div1, "keydown", /*keydown_handler*/ ctx[12], false, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[9], false, false, false, false),
    					listen_dev(div2, "keydown", /*keydown_handler_1*/ ctx[13], false, false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[11], false, false, false, false),
    					listen_dev(div3, "keydown", /*keydown_handler_2*/ ctx[14], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*isPaused*/ 64) && raw_value !== (raw_value = (/*isPaused*/ ctx[6]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const convolutionanimator_changes = {};
    			if (dirty & /*kernel*/ 4) convolutionanimator_changes.kernel = /*kernel*/ ctx[2];
    			if (dirty & /*input*/ 2) convolutionanimator_changes.image = /*input*/ ctx[1];
    			if (dirty & /*outputFinal*/ 128) convolutionanimator_changes.output = /*outputFinal*/ ctx[7];
    			if (dirty & /*isPaused*/ 64) convolutionanimator_changes.isPaused = /*isPaused*/ ctx[6];
    			if (dirty & /*dataRange*/ 8) convolutionanimator_changes.dataRange = /*dataRange*/ ctx[3];
    			if (dirty & /*colorScale*/ 16) convolutionanimator_changes.colorScale = /*colorScale*/ ctx[4];
    			if (dirty & /*isInputInputLayer*/ 32) convolutionanimator_changes.isInputInputLayer = /*isInputInputLayer*/ ctx[5];
    			convolutionanimator.$set(convolutionanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(convolutionanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(convolutionanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(convolutionanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(117:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const dilation = 1;

    function handleScroll() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-convolution`);
    	scroll.animateScroll(anchor);
    }

    function handleControlKeydown(event, callback) {
    	if (event.key === 'Enter' || event.key === ' ') {
    		event.preventDefault();
    		callback();
    	}
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Convolutionview', slots, []);
    	let { input } = $$props;
    	let { kernel } = $$props;
    	let { dataRange } = $$props;
    	let { colorScale = d3.interpolateRdBu } = $$props;
    	let { isInputInputLayer = false } = $$props;
    	let { isExited = false } = $$props;

    	// export let output;
    	const dispatch = createEventDispatcher();

    	let stride = 1;
    	var isPaused = false;
    	var outputFinal = singleConv(input, kernel, stride);

    	function handleClickPause() {
    		$$invalidate(6, isPaused = !isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(6, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		$$invalidate(0, isExited = true);
    		dispatch('message', { text: isExited });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console_1.warn("<Convolutionview> was created without expected prop 'input'");
    		}

    		if (kernel === undefined && !('kernel' in $$props || $$self.$$.bound[$$self.$$.props['kernel']])) {
    			console_1.warn("<Convolutionview> was created without expected prop 'kernel'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console_1.warn("<Convolutionview> was created without expected prop 'dataRange'");
    		}
    	});

    	const writable_props = ['input', 'kernel', 'dataRange', 'colorScale', 'isInputInputLayer', 'isExited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Convolutionview> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = event => handleControlKeydown(event, handleScroll);
    	const keydown_handler_1 = event => handleControlKeydown(event, handleClickPause);
    	const keydown_handler_2 = event => handleControlKeydown(event, handleClickX);

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(1, input = $$props.input);
    		if ('kernel' in $$props) $$invalidate(2, kernel = $$props.kernel);
    		if ('dataRange' in $$props) $$invalidate(3, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(4, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(5, isInputInputLayer = $$props.isInputInputLayer);
    		if ('isExited' in $$props) $$invalidate(0, isExited = $$props.isExited);
    	};

    	$$self.$capture_state = () => ({
    		ConvolutionAnimator,
    		singleConv,
    		createEventDispatcher,
    		input,
    		kernel,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		isExited,
    		dispatch,
    		stride,
    		dilation,
    		isPaused,
    		outputFinal,
    		handleClickPause,
    		handleScroll,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleControlKeydown
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(1, input = $$props.input);
    		if ('kernel' in $$props) $$invalidate(2, kernel = $$props.kernel);
    		if ('dataRange' in $$props) $$invalidate(3, dataRange = $$props.dataRange);
    		if ('colorScale' in $$props) $$invalidate(4, colorScale = $$props.colorScale);
    		if ('isInputInputLayer' in $$props) $$invalidate(5, isInputInputLayer = $$props.isInputInputLayer);
    		if ('isExited' in $$props) $$invalidate(0, isExited = $$props.isExited);
    		if ('stride' in $$props) $$invalidate(8, stride = $$props.stride);
    		if ('isPaused' in $$props) $$invalidate(6, isPaused = $$props.isPaused);
    		if ('outputFinal' in $$props) $$invalidate(7, outputFinal = $$props.outputFinal);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*input, kernel*/ 6) {
    			 if (stride > 0) {
    				try {
    					$$invalidate(7, outputFinal = singleConv(input, kernel, stride));
    				} catch {
    					console.log("Cannot handle stride of " + stride);
    				}
    			}
    		}
    	};

    	return [
    		isExited,
    		input,
    		kernel,
    		dataRange,
    		colorScale,
    		isInputInputLayer,
    		isPaused,
    		outputFinal,
    		stride,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		keydown_handler,
    		keydown_handler_1,
    		keydown_handler_2
    	];
    }

    class Convolutionview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			input: 1,
    			kernel: 2,
    			dataRange: 3,
    			colorScale: 4,
    			isInputInputLayer: 5,
    			isExited: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Convolutionview",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get input() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernel() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernel(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorScale() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorScale(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isInputInputLayer() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isInputInputLayer(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Convolutionview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Convolutionview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\ActivationAnimator.svelte generated by Svelte v3.59.2 */
    const file$4 = "src\\detail-view\\ActivationAnimator.svelte";

    // (104:2) {:else}
    function create_else_block(ctx) {
    	let span;
    	let t0;
    	let dataview0;
    	let t1;
    	let dataview1;
    	let t2;
    	let dataview2;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: gridData([[0]]),
    				highlights: /*outputHighlights*/ ctx[5],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview1 = new Dataview({
    			props: {
    				data: /*gridInputMatrixSlice*/ ctx[6],
    				highlights: /*outputHighlights*/ ctx[5],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*gridOutputMatrixSlice*/ ctx[7],
    				highlights: /*outputHighlights*/ ctx[5],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text("max(\r\n      ");
    			create_component(dataview0.$$.fragment);
    			t1 = text("\r\n      ,\r\n      ");
    			create_component(dataview1.$$.fragment);
    			t2 = text("\r\n      )\r\n      =\r\n      ");
    			create_component(dataview2.$$.fragment);
    			add_location(span, file$4, 104, 4, 4042);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t0);
    			mount_component(dataview0, span, null);
    			append_dev(span, t1);
    			mount_component(dataview1, span, null);
    			append_dev(span, t2);
    			mount_component(dataview2, span, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dataview0_changes = {};
    			if (dirty & /*outputHighlights*/ 32) dataview0_changes.highlights = /*outputHighlights*/ ctx[5];
    			if (dirty & /*dataRange*/ 4) dataview0_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview0.$set(dataview0_changes);
    			const dataview1_changes = {};
    			if (dirty & /*gridInputMatrixSlice*/ 64) dataview1_changes.data = /*gridInputMatrixSlice*/ ctx[6];
    			if (dirty & /*outputHighlights*/ 32) dataview1_changes.highlights = /*outputHighlights*/ ctx[5];
    			if (dirty & /*dataRange*/ 4) dataview1_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview1.$set(dataview1_changes);
    			const dataview2_changes = {};
    			if (dirty & /*gridOutputMatrixSlice*/ 128) dataview2_changes.data = /*gridOutputMatrixSlice*/ ctx[7];
    			if (dirty & /*outputHighlights*/ 32) dataview2_changes.highlights = /*outputHighlights*/ ctx[5];
    			if (dirty & /*dataRange*/ 4) dataview2_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview2.$set(dataview2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			destroy_component(dataview0);
    			destroy_component(dataview1);
    			destroy_component(dataview2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(104:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (94:2) {#if activationType === 'sigmoid'}
    function create_if_block$1(ctx) {
    	let span;
    	let t0;
    	let dataview0;
    	let t1;
    	let dataview1;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*gridInputMatrixSlice*/ ctx[6],
    				highlights: /*outputHighlights*/ ctx[5],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview1 = new Dataview({
    			props: {
    				data: /*gridOutputMatrixSlice*/ ctx[7],
    				highlights: /*outputHighlights*/ ctx[5],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text("sigmoid(\r\n      ");
    			create_component(dataview0.$$.fragment);
    			t1 = text("\r\n      )\r\n      =\r\n      ");
    			create_component(dataview1.$$.fragment);
    			add_location(span, file$4, 94, 4, 3685);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t0);
    			mount_component(dataview0, span, null);
    			append_dev(span, t1);
    			mount_component(dataview1, span, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dataview0_changes = {};
    			if (dirty & /*gridInputMatrixSlice*/ 64) dataview0_changes.data = /*gridInputMatrixSlice*/ ctx[6];
    			if (dirty & /*outputHighlights*/ 32) dataview0_changes.highlights = /*outputHighlights*/ ctx[5];
    			if (dirty & /*dataRange*/ 4) dataview0_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview0.$set(dataview0_changes);
    			const dataview1_changes = {};
    			if (dirty & /*gridOutputMatrixSlice*/ 128) dataview1_changes.data = /*gridOutputMatrixSlice*/ ctx[7];
    			if (dirty & /*outputHighlights*/ 32) dataview1_changes.highlights = /*outputHighlights*/ ctx[5];
    			if (dirty & /*dataRange*/ 4) dataview1_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview1.$set(dataview1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			destroy_component(dataview0);
    			destroy_component(dataview1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(94:2) {#if activationType === 'sigmoid'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*image*/ ctx[0].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*image*/ ctx[0][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div2;
    	let current_block_type_index;
    	let if_block;
    	let t7;
    	let div4;
    	let div3;
    	let t8;
    	let t9_value = /*output*/ ctx[1].length + "";
    	let t9;
    	let t10;
    	let t11_value = /*output*/ ctx[1][0].length + "";
    	let t11;
    	let t12;
    	let t13;
    	let dataview1;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*gridImage*/ ctx[8],
    				highlights: /*inputHighlights*/ ctx[4],
    				outputLength: /*output*/ ctx[1].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[0].length),
    				dataRange: /*dataRange*/ ctx[2],
    				stride: 1
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[10]);
    	const if_block_creators = [create_if_block$1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*activationType*/ ctx[3] === 'sigmoid') return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	dataview1 = new Dataview({
    			props: {
    				data: /*gridOutput*/ ctx[9],
    				highlights: /*outputHighlights*/ ctx[5],
    				isKernelMath: false,
    				outputLength: /*output*/ ctx[1].length,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[2],
    				stride: 1
    			},
    			$$inline: true
    		});

    	dataview1.$on("message", /*handleMouseover*/ ctx[10]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			if_block.c();
    			t7 = space();
    			div4 = element("div");
    			div3 = element("div");
    			t8 = text("Output (");
    			t9 = text(t9_value);
    			t10 = text(", ");
    			t11 = text(t11_value);
    			t12 = text(")");
    			t13 = space();
    			create_component(dataview1.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$4, 86, 2, 3271);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$4, 85, 0, 3229);
    			attr_dev(div2, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div2, file$4, 92, 0, 3603);
    			attr_dev(div3, "class", "header-text");
    			add_location(div3, file$4, 119, 2, 4585);
    			attr_dev(div4, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div4, file$4, 118, 0, 4543);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			if_blocks[current_block_type_index].m(div2, null);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, t8);
    			append_dev(div3, t9);
    			append_dev(div3, t10);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div4, t13);
    			mount_component(dataview1, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*image*/ 1) && t1_value !== (t1_value = /*image*/ ctx[0].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*image*/ 1) && t3_value !== (t3_value = /*image*/ ctx[0][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*gridImage*/ 256) dataview0_changes.data = /*gridImage*/ ctx[8];
    			if (dirty & /*inputHighlights*/ 16) dataview0_changes.highlights = /*inputHighlights*/ ctx[4];
    			if (dirty & /*output*/ 2) dataview0_changes.outputLength = /*output*/ ctx[1].length;
    			if (dirty & /*image*/ 1) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[0].length);
    			if (dirty & /*dataRange*/ 4) dataview0_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview0.$set(dataview0_changes);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div2, null);
    			}

    			if ((!current || dirty & /*output*/ 2) && t9_value !== (t9_value = /*output*/ ctx[1].length + "")) set_data_dev(t9, t9_value);
    			if ((!current || dirty & /*output*/ 2) && t11_value !== (t11_value = /*output*/ ctx[1][0].length + "")) set_data_dev(t11, t11_value);
    			const dataview1_changes = {};
    			if (dirty & /*gridOutput*/ 512) dataview1_changes.data = /*gridOutput*/ ctx[9];
    			if (dirty & /*outputHighlights*/ 32) dataview1_changes.highlights = /*outputHighlights*/ ctx[5];
    			if (dirty & /*output*/ 2) dataview1_changes.outputLength = /*output*/ ctx[1].length;
    			if (dirty & /*output*/ 2) dataview1_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 4) dataview1_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview1.$set(dataview1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(dataview1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(dataview1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			if_blocks[current_block_type_index].d();
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div4);
    			destroy_component(dataview1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding$1 = 0;

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ActivationAnimator', slots, []);
    	let { image } = $$props;
    	let { output } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	let { activationType = 'relu' } = $$props;
    	const dispatch = createEventDispatcher();
    	let padded_input_size = image.length + padding$1 * 2;
    	let gridInputMatrixSlice = gridData([[0]]);
    	let gridOutputMatrixSlice = gridData([[0]]);
    	let inputHighlights = array1d(image.length * image.length, i => true);
    	let outputHighlights = array1d(output.length * output.length, i => true);
    	let interval;
    	let counter;

    	// lots of replication between mouseover and start animation. TODO: fix this.
    	function startActivation() {
    		counter = 0;
    		if (interval) clearInterval(interval);

    		$$invalidate(12, interval = setInterval(
    			() => {
    				if (isPaused) return;
    				const flat_animated = counter % (output.length * output.length);
    				$$invalidate(5, outputHighlights = array1d(output.length * output.length, i => false));
    				$$invalidate(4, inputHighlights = array1d(image.length * image.length, i => undefined));
    				const animatedH = Math.floor(flat_animated / output.length);
    				const animatedW = flat_animated % output.length;
    				$$invalidate(5, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    				$$invalidate(4, inputHighlights[animatedH * output.length + animatedW] = true, inputHighlights);
    				const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, 1);
    				$$invalidate(6, gridInputMatrixSlice = gridData(inputMatrixSlice));
    				const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    				$$invalidate(7, gridOutputMatrixSlice = gridData(outputMatrixSlice));
    				counter++;
    			},
    			250
    		));
    	}

    	function handleMouseover(event) {
    		$$invalidate(5, outputHighlights = array1d(output.length * output.length, i => false));
    		const animatedH = event.detail.hoverH;
    		const animatedW = event.detail.hoverW;
    		$$invalidate(5, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    		$$invalidate(4, inputHighlights = array1d(image.length * image.length, i => undefined));
    		$$invalidate(4, inputHighlights[animatedH * output.length + animatedW] = true, inputHighlights);
    		const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, 1);
    		$$invalidate(6, gridInputMatrixSlice = gridData(inputMatrixSlice));
    		const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    		$$invalidate(7, gridOutputMatrixSlice = gridData(outputMatrixSlice));
    		$$invalidate(11, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startActivation();
    	let gridImage = gridData(image);
    	let gridOutput = gridData(output);

    	$$self.$$.on_mount.push(function () {
    		if (image === undefined && !('image' in $$props || $$self.$$.bound[$$self.$$.props['image']])) {
    			console.warn("<ActivationAnimator> was created without expected prop 'image'");
    		}

    		if (output === undefined && !('output' in $$props || $$self.$$.bound[$$self.$$.props['output']])) {
    			console.warn("<ActivationAnimator> was created without expected prop 'output'");
    		}

    		if (isPaused === undefined && !('isPaused' in $$props || $$self.$$.bound[$$self.$$.props['isPaused']])) {
    			console.warn("<ActivationAnimator> was created without expected prop 'isPaused'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<ActivationAnimator> was created without expected prop 'dataRange'");
    		}
    	});

    	const writable_props = ['image', 'output', 'isPaused', 'dataRange', 'activationType'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ActivationAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('image' in $$props) $$invalidate(0, image = $$props.image);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(11, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('activationType' in $$props) $$invalidate(3, activationType = $$props.activationType);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getMatrixSliceFromOutputHighlights,
    		getVisualizationSizeConstraint,
    		getMatrixSliceFromInputHighlights,
    		gridData,
    		Dataview,
    		image,
    		output,
    		isPaused,
    		dataRange,
    		activationType,
    		dispatch,
    		padding: padding$1,
    		padded_input_size,
    		gridInputMatrixSlice,
    		gridOutputMatrixSlice,
    		inputHighlights,
    		outputHighlights,
    		interval,
    		counter,
    		startActivation,
    		handleMouseover,
    		gridImage,
    		gridOutput
    	});

    	$$self.$inject_state = $$props => {
    		if ('image' in $$props) $$invalidate(0, image = $$props.image);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(11, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('activationType' in $$props) $$invalidate(3, activationType = $$props.activationType);
    		if ('padded_input_size' in $$props) padded_input_size = $$props.padded_input_size;
    		if ('gridInputMatrixSlice' in $$props) $$invalidate(6, gridInputMatrixSlice = $$props.gridInputMatrixSlice);
    		if ('gridOutputMatrixSlice' in $$props) $$invalidate(7, gridOutputMatrixSlice = $$props.gridOutputMatrixSlice);
    		if ('inputHighlights' in $$props) $$invalidate(4, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(5, outputHighlights = $$props.outputHighlights);
    		if ('interval' in $$props) $$invalidate(12, interval = $$props.interval);
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('gridImage' in $$props) $$invalidate(8, gridImage = $$props.gridImage);
    		if ('gridOutput' in $$props) $$invalidate(9, gridOutput = $$props.gridOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 1) {
    			 padded_input_size = image.length + padding$1 * 2;
    		}

    		if ($$self.$$.dirty & /*image, output*/ 3) {
    			 {
    				let inputHighlights = array1d(image.length * image.length, i => true);
    				let outputHighlights = array1d(output.length * output.length, i => true);
    			}
    		}

    		if ($$self.$$.dirty & /*image, output*/ 3) {
    			 {
    				startActivation();
    				$$invalidate(8, gridImage = gridData(image));
    				$$invalidate(9, gridOutput = gridData(output));
    			}
    		}
    	};

    	return [
    		image,
    		output,
    		dataRange,
    		activationType,
    		inputHighlights,
    		outputHighlights,
    		gridInputMatrixSlice,
    		gridOutputMatrixSlice,
    		gridImage,
    		gridOutput,
    		handleMouseover,
    		isPaused,
    		interval
    	];
    }

    class ActivationAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			image: 0,
    			output: 1,
    			isPaused: 11,
    			dataRange: 2,
    			activationType: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ActivationAnimator",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get image() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activationType() {
    		throw new Error("<ActivationAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activationType(value) {
    		throw new Error("<ActivationAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Activationview.svelte generated by Svelte v3.59.2 */
    const file$5 = "src\\detail-view\\Activationview.svelte";

    // (105:0) {#if !isExited}
    function create_if_block$2(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[6]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let activationanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	activationanimator = new ActivationAnimator({
    			props: {
    				image: /*input*/ ctx[0],
    				output: /*output*/ ctx[1],
    				isPaused: /*isPaused*/ ctx[6],
    				dataRange: /*dataRange*/ ctx[2],
    				activationType: /*activationType*/ ctx[5]
    			},
    			$$inline: true
    		});

    	activationanimator.$on("message", /*handlePauseFromInteraction*/ ctx[8]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			t0 = text(/*title*/ ctx[4]);
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(activationanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to change pixel.");
    			attr_dev(div0, "class", "title-text svelte-1lq7956");
    			add_location(div0, file$5, 110, 8, 2211);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$5, 122, 12, 2573);
    			attr_dev(div1, "class", "control-button svelte-1lq7956");
    			attr_dev(div1, "role", "button");
    			attr_dev(div1, "tabindex", "0");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$5, 116, 10, 2317);
    			attr_dev(div2, "class", "play-button control-button svelte-1lq7956");
    			attr_dev(div2, "role", "button");
    			attr_dev(div2, "tabindex", "0");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$5, 125, 10, 2639);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$5, 142, 14, 3327);
    			attr_dev(div3, "class", "delete-button control-button svelte-1lq7956");
    			attr_dev(div3, "role", "button");
    			attr_dev(div3, "tabindex", "0");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$5, 136, 10, 3073);
    			attr_dev(div4, "class", "buttons svelte-1lq7956");
    			add_location(div4, file$5, 114, 8, 2282);
    			attr_dev(div5, "class", "control-pannel svelte-1lq7956");
    			add_location(div5, file$5, 108, 6, 2171);
    			attr_dev(div6, "class", "container is-centered is-vcentered svelte-1lq7956");
    			add_location(div6, file$5, 148, 6, 3435);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-1lq7956");
    			add_location(img, file$5, 155, 8, 3739);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$5, 157, 10, 3854);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$5, 156, 8, 3813);
    			attr_dev(div8, "class", "annotation svelte-1lq7956");
    			add_location(div8, file$5, 154, 6, 3705);
    			attr_dev(div9, "class", "box svelte-1lq7956");
    			add_location(div9, file$5, 106, 4, 2144);
    			attr_dev(div10, "class", "container svelte-1lq7956");
    			add_location(div10, file$5, 105, 2, 2115);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div0, t0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(activationanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*handleScroll*/ ctx[10], false, false, false, false),
    					listen_dev(div1, "keydown", /*keydown_handler*/ ctx[12], false, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[7], false, false, false, false),
    					listen_dev(div2, "keydown", /*keydown_handler_1*/ ctx[13], false, false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[9], false, false, false, false),
    					listen_dev(div3, "keydown", /*keydown_handler_2*/ ctx[14], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*title*/ 16) set_data_dev(t0, /*title*/ ctx[4]);

    			if ((!current || dirty & /*isPaused*/ 64) && raw_value !== (raw_value = (/*isPaused*/ ctx[6]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const activationanimator_changes = {};
    			if (dirty & /*input*/ 1) activationanimator_changes.image = /*input*/ ctx[0];
    			if (dirty & /*output*/ 2) activationanimator_changes.output = /*output*/ ctx[1];
    			if (dirty & /*isPaused*/ 64) activationanimator_changes.isPaused = /*isPaused*/ ctx[6];
    			if (dirty & /*dataRange*/ 4) activationanimator_changes.dataRange = /*dataRange*/ ctx[2];
    			if (dirty & /*activationType*/ 32) activationanimator_changes.activationType = /*activationType*/ ctx[5];
    			activationanimator.$set(activationanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(activationanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(activationanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(activationanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(105:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[3] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleControlKeydown$1(event, callback) {
    	if (event.key === 'Enter' || event.key === ' ') {
    		event.preventDefault();
    		callback();
    	}
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Activationview', slots, []);
    	let { input } = $$props;
    	let { output } = $$props;
    	let { dataRange } = $$props;
    	let { isExited } = $$props;
    	let { title = 'ReLU Activation' } = $$props;
    	let { activationType = 'relu' } = $$props;
    	let { articleAnchor = 'article-relu' } = $$props;
    	const dispatch = createEventDispatcher();
    	let isPaused = false;

    	function handleClickPause() {
    		$$invalidate(6, isPaused = !isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(6, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		dispatch('message', { text: true });
    	}

    	function handleScroll() {
    		let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    		let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    		let anchor = document.querySelector(`#${articleAnchor}`);
    		scroll.animateScroll(anchor);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console.warn("<Activationview> was created without expected prop 'input'");
    		}

    		if (output === undefined && !('output' in $$props || $$self.$$.bound[$$self.$$.props['output']])) {
    			console.warn("<Activationview> was created without expected prop 'output'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<Activationview> was created without expected prop 'dataRange'");
    		}

    		if (isExited === undefined && !('isExited' in $$props || $$self.$$.bound[$$self.$$.props['isExited']])) {
    			console.warn("<Activationview> was created without expected prop 'isExited'");
    		}
    	});

    	const writable_props = [
    		'input',
    		'output',
    		'dataRange',
    		'isExited',
    		'title',
    		'activationType',
    		'articleAnchor'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Activationview> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = event => handleControlKeydown$1(event, handleScroll);
    	const keydown_handler_1 = event => handleControlKeydown$1(event, handleClickPause);
    	const keydown_handler_2 = event => handleControlKeydown$1(event, handleClickX);

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    		if ('title' in $$props) $$invalidate(4, title = $$props.title);
    		if ('activationType' in $$props) $$invalidate(5, activationType = $$props.activationType);
    		if ('articleAnchor' in $$props) $$invalidate(11, articleAnchor = $$props.articleAnchor);
    	};

    	$$self.$capture_state = () => ({
    		ActivationAnimator,
    		createEventDispatcher,
    		input,
    		output,
    		dataRange,
    		isExited,
    		title,
    		activationType,
    		articleAnchor,
    		dispatch,
    		isPaused,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleScroll,
    		handleControlKeydown: handleControlKeydown$1
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    		if ('title' in $$props) $$invalidate(4, title = $$props.title);
    		if ('activationType' in $$props) $$invalidate(5, activationType = $$props.activationType);
    		if ('articleAnchor' in $$props) $$invalidate(11, articleAnchor = $$props.articleAnchor);
    		if ('isPaused' in $$props) $$invalidate(6, isPaused = $$props.isPaused);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		input,
    		output,
    		dataRange,
    		isExited,
    		title,
    		activationType,
    		isPaused,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleScroll,
    		articleAnchor,
    		keydown_handler,
    		keydown_handler_1,
    		keydown_handler_2
    	];
    }

    class Activationview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			input: 0,
    			output: 1,
    			dataRange: 2,
    			isExited: 3,
    			title: 4,
    			activationType: 5,
    			articleAnchor: 11
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Activationview",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get input() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activationType() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activationType(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get articleAnchor() {
    		throw new Error("<Activationview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set articleAnchor(value) {
    		throw new Error("<Activationview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\PoolAnimator.svelte generated by Svelte v3.59.2 */
    const file$6 = "src\\detail-view\\PoolAnimator.svelte";

    function create_fragment$6(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*testImage*/ ctx[9].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*testImage*/ ctx[9][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div2;
    	let span;
    	let t7;
    	let dataview1;
    	let t8;
    	let dataview2;
    	let t9;
    	let div4;
    	let div3;
    	let t10;
    	let t11_value = /*testOutput*/ ctx[10].length + "";
    	let t11;
    	let t12;
    	let t13_value = /*testOutput*/ ctx[10][0].length + "";
    	let t13;
    	let t14;
    	let t15;
    	let dataview3;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*testImage*/ ctx[9],
    				highlights: /*inputHighlights*/ ctx[5],
    				outputLength: /*output*/ ctx[3].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[2].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0]
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[11]);

    	dataview1 = new Dataview({
    			props: {
    				data: /*testInputMatrixSlice*/ ctx[7],
    				highlights: /*outputHighlights*/ ctx[6],
    				isKernelMath: true,
    				constraint: getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]),
    				dataRange: /*dataRange*/ ctx[4]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*testOutputMatrixSlice*/ ctx[8],
    				highlights: /*outputHighlights*/ ctx[6],
    				isKernelMath: true,
    				constraint: getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]),
    				dataRange: /*dataRange*/ ctx[4]
    			},
    			$$inline: true
    		});

    	dataview3 = new Dataview({
    			props: {
    				data: /*testOutput*/ ctx[10],
    				highlights: /*outputHighlights*/ ctx[6],
    				isKernelMath: false,
    				outputLength: /*output*/ ctx[3].length,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[3].length),
    				dataRange: /*dataRange*/ ctx[4],
    				stride: /*stride*/ ctx[0]
    			},
    			$$inline: true
    		});

    	dataview3.$on("message", /*handleMouseover*/ ctx[11]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			span = element("span");
    			t7 = text("max(\r\n    ");
    			create_component(dataview1.$$.fragment);
    			t8 = text("\r\n    )\r\n    =\r\n    ");
    			create_component(dataview2.$$.fragment);
    			t9 = space();
    			div4 = element("div");
    			div3 = element("div");
    			t10 = text("Output (");
    			t11 = text(t11_value);
    			t12 = text(", ");
    			t13 = text(t13_value);
    			t14 = text(")");
    			t15 = space();
    			create_component(dataview3.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$6, 99, 2, 3821);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$6, 98, 0, 3779);
    			add_location(span, file$6, 107, 2, 4210);
    			attr_dev(div2, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div2, file$6, 106, 0, 4168);
    			attr_dev(div3, "class", "header-text");
    			add_location(div3, file$6, 118, 2, 4671);
    			attr_dev(div4, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div4, file$6, 117, 0, 4629);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, span);
    			append_dev(span, t7);
    			mount_component(dataview1, span, null);
    			append_dev(span, t8);
    			mount_component(dataview2, span, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, t10);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div3, t13);
    			append_dev(div3, t14);
    			append_dev(div4, t15);
    			mount_component(dataview3, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*testImage*/ 512) && t1_value !== (t1_value = /*testImage*/ ctx[9].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*testImage*/ 512) && t3_value !== (t3_value = /*testImage*/ ctx[9][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*testImage*/ 512) dataview0_changes.data = /*testImage*/ ctx[9];
    			if (dirty & /*inputHighlights*/ 32) dataview0_changes.highlights = /*inputHighlights*/ ctx[5];
    			if (dirty & /*output*/ 8) dataview0_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*image*/ 4) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[2].length);
    			if (dirty & /*dataRange*/ 16) dataview0_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview0_changes.stride = /*stride*/ ctx[0];
    			dataview0.$set(dataview0_changes);
    			const dataview1_changes = {};
    			if (dirty & /*testInputMatrixSlice*/ 128) dataview1_changes.data = /*testInputMatrixSlice*/ ctx[7];
    			if (dirty & /*outputHighlights*/ 64) dataview1_changes.highlights = /*outputHighlights*/ ctx[6];
    			if (dirty & /*kernelLength*/ 2) dataview1_changes.constraint = getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]);
    			if (dirty & /*dataRange*/ 16) dataview1_changes.dataRange = /*dataRange*/ ctx[4];
    			dataview1.$set(dataview1_changes);
    			const dataview2_changes = {};
    			if (dirty & /*testOutputMatrixSlice*/ 256) dataview2_changes.data = /*testOutputMatrixSlice*/ ctx[8];
    			if (dirty & /*outputHighlights*/ 64) dataview2_changes.highlights = /*outputHighlights*/ ctx[6];
    			if (dirty & /*kernelLength*/ 2) dataview2_changes.constraint = getVisualizationSizeConstraint(/*kernelLength*/ ctx[1]);
    			if (dirty & /*dataRange*/ 16) dataview2_changes.dataRange = /*dataRange*/ ctx[4];
    			dataview2.$set(dataview2_changes);
    			if ((!current || dirty & /*testOutput*/ 1024) && t11_value !== (t11_value = /*testOutput*/ ctx[10].length + "")) set_data_dev(t11, t11_value);
    			if ((!current || dirty & /*testOutput*/ 1024) && t13_value !== (t13_value = /*testOutput*/ ctx[10][0].length + "")) set_data_dev(t13, t13_value);
    			const dataview3_changes = {};
    			if (dirty & /*testOutput*/ 1024) dataview3_changes.data = /*testOutput*/ ctx[10];
    			if (dirty & /*outputHighlights*/ 64) dataview3_changes.highlights = /*outputHighlights*/ ctx[6];
    			if (dirty & /*output*/ 8) dataview3_changes.outputLength = /*output*/ ctx[3].length;
    			if (dirty & /*output*/ 8) dataview3_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[3].length);
    			if (dirty & /*dataRange*/ 16) dataview3_changes.dataRange = /*dataRange*/ ctx[4];
    			if (dirty & /*stride*/ 1) dataview3_changes.stride = /*stride*/ ctx[0];
    			dataview3.$set(dataview3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			transition_in(dataview3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			transition_out(dataview3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			destroy_component(dataview1);
    			destroy_component(dataview2);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div4);
    			destroy_component(dataview3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const padding$2 = 0;

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PoolAnimator', slots, []);
    	let { stride } = $$props;
    	let { dilation } = $$props;
    	let { kernelLength } = $$props;
    	let { image } = $$props;
    	let { output } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	const dispatch = createEventDispatcher();
    	let padded_input_size = image.length + padding$2 * 2;

    	// Dummy data for original state of component.
    	let testInputMatrixSlice = [];

    	for (let i = 0; i < kernelLength; i++) {
    		testInputMatrixSlice.push([]);

    		for (let j = 0; j < kernelLength; j++) {
    			testInputMatrixSlice[i].push(0);
    		}
    	}

    	testInputMatrixSlice = gridData(testInputMatrixSlice);
    	let testOutputMatrixSlice = gridData([[0]]);
    	let inputHighlights = [];
    	let outputHighlights = array1d(output.length * output.length, i => true);
    	let interval;
    	let counter;

    	// lots of replication between mouseover and start-pool. TODO: fix this.
    	function startMaxPool(stride) {
    		counter = 0;
    		let outputMappings = generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation);
    		if (stride <= 0) return;
    		if (interval) clearInterval(interval);

    		$$invalidate(14, interval = setInterval(
    			() => {
    				if (isPaused) return;
    				const flat_animated = counter % (output.length * output.length);
    				$$invalidate(6, outputHighlights = array1d(output.length * output.length, i => false));
    				const animatedH = Math.floor(flat_animated / output.length);
    				const animatedW = flat_animated % output.length;
    				$$invalidate(6, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    				$$invalidate(5, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernelLength, outputMappings, kernelLength));
    				const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernelLength);
    				$$invalidate(7, testInputMatrixSlice = gridData(inputMatrixSlice));
    				const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    				$$invalidate(8, testOutputMatrixSlice = gridData(outputMatrixSlice));
    				counter++;
    			},
    			250
    		));
    	}

    	function handleMouseover(event) {
    		let outputMappings = generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation);
    		$$invalidate(6, outputHighlights = array1d(output.length * output.length, i => false));
    		const animatedH = event.detail.hoverH;
    		const animatedW = event.detail.hoverW;
    		$$invalidate(6, outputHighlights[animatedH * output.length + animatedW] = true, outputHighlights);
    		$$invalidate(5, inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernelLength, outputMappings, kernelLength));
    		const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernelLength);
    		$$invalidate(7, testInputMatrixSlice = gridData(inputMatrixSlice));
    		const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    		$$invalidate(8, testOutputMatrixSlice = gridData(outputMatrixSlice));
    		$$invalidate(12, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startMaxPool(stride);
    	let testImage = gridData(image);
    	let testOutput = gridData(output);

    	$$self.$$.on_mount.push(function () {
    		if (stride === undefined && !('stride' in $$props || $$self.$$.bound[$$self.$$.props['stride']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'stride'");
    		}

    		if (dilation === undefined && !('dilation' in $$props || $$self.$$.bound[$$self.$$.props['dilation']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'dilation'");
    		}

    		if (kernelLength === undefined && !('kernelLength' in $$props || $$self.$$.bound[$$self.$$.props['kernelLength']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'kernelLength'");
    		}

    		if (image === undefined && !('image' in $$props || $$self.$$.bound[$$self.$$.props['image']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'image'");
    		}

    		if (output === undefined && !('output' in $$props || $$self.$$.bound[$$self.$$.props['output']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'output'");
    		}

    		if (isPaused === undefined && !('isPaused' in $$props || $$self.$$.bound[$$self.$$.props['isPaused']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'isPaused'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<PoolAnimator> was created without expected prop 'dataRange'");
    		}
    	});

    	const writable_props = [
    		'stride',
    		'dilation',
    		'kernelLength',
    		'image',
    		'output',
    		'isPaused',
    		'dataRange'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PoolAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(13, dilation = $$props.dilation);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(12, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getMatrixSliceFromOutputHighlights,
    		compute_input_multiplies_with_weight,
    		getVisualizationSizeConstraint,
    		generateOutputMappings,
    		getMatrixSliceFromInputHighlights,
    		gridData,
    		Dataview,
    		stride,
    		dilation,
    		kernelLength,
    		image,
    		output,
    		isPaused,
    		dataRange,
    		dispatch,
    		padding: padding$2,
    		padded_input_size,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		inputHighlights,
    		outputHighlights,
    		interval,
    		counter,
    		startMaxPool,
    		handleMouseover,
    		testImage,
    		testOutput
    	});

    	$$self.$inject_state = $$props => {
    		if ('stride' in $$props) $$invalidate(0, stride = $$props.stride);
    		if ('dilation' in $$props) $$invalidate(13, dilation = $$props.dilation);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('output' in $$props) $$invalidate(3, output = $$props.output);
    		if ('isPaused' in $$props) $$invalidate(12, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(4, dataRange = $$props.dataRange);
    		if ('padded_input_size' in $$props) padded_input_size = $$props.padded_input_size;
    		if ('testInputMatrixSlice' in $$props) $$invalidate(7, testInputMatrixSlice = $$props.testInputMatrixSlice);
    		if ('testOutputMatrixSlice' in $$props) $$invalidate(8, testOutputMatrixSlice = $$props.testOutputMatrixSlice);
    		if ('inputHighlights' in $$props) $$invalidate(5, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(6, outputHighlights = $$props.outputHighlights);
    		if ('interval' in $$props) $$invalidate(14, interval = $$props.interval);
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('testImage' in $$props) $$invalidate(9, testImage = $$props.testImage);
    		if ('testOutput' in $$props) $$invalidate(10, testOutput = $$props.testOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 4) {
    			 padded_input_size = image.length + padding$2 * 2;
    		}

    		if ($$self.$$.dirty & /*output*/ 8) {
    			 {
    				let outputHighlights = array1d(output.length * output.length, i => true);
    			}
    		}

    		if ($$self.$$.dirty & /*stride, image, output*/ 13) {
    			 {
    				startMaxPool(stride);
    				$$invalidate(9, testImage = gridData(image));
    				$$invalidate(10, testOutput = gridData(output));
    			}
    		}
    	};

    	return [
    		stride,
    		kernelLength,
    		image,
    		output,
    		dataRange,
    		inputHighlights,
    		outputHighlights,
    		testInputMatrixSlice,
    		testOutputMatrixSlice,
    		testImage,
    		testOutput,
    		handleMouseover,
    		isPaused,
    		dilation,
    		interval
    	];
    }

    class PoolAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			stride: 0,
    			dilation: 13,
    			kernelLength: 1,
    			image: 2,
    			output: 3,
    			isPaused: 12,
    			dataRange: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PoolAnimator",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get stride() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stride(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dilation() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dilation(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelLength() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelLength(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<PoolAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<PoolAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Poolview.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;
    const file$7 = "src\\detail-view\\Poolview.svelte";

    // (146:0) {#if !isExited}
    function create_if_block$3(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[4]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let poolanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	poolanimator = new PoolAnimator({
    			props: {
    				kernelLength: /*kernelLength*/ ctx[1],
    				image: /*input*/ ctx[0],
    				output: /*outputFinal*/ ctx[5],
    				stride: /*stride*/ ctx[6],
    				dilation: dilation$1,
    				isPaused: /*isPaused*/ ctx[4],
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	poolanimator.$on("message", /*handlePauseFromInteraction*/ ctx[8]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "Max Pooling";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(poolanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to change kernel position.");
    			attr_dev(div0, "class", "title-text svelte-kahisg");
    			add_location(div0, file$7, 167, 8, 3928);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$7, 179, 12, 4294);
    			attr_dev(div1, "class", "control-button svelte-kahisg");
    			attr_dev(div1, "role", "button");
    			attr_dev(div1, "tabindex", "0");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$7, 173, 10, 4038);
    			attr_dev(div2, "class", "play-button control-button svelte-kahisg");
    			attr_dev(div2, "role", "button");
    			attr_dev(div2, "tabindex", "0");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$7, 182, 10, 4360);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$7, 199, 12, 5046);
    			attr_dev(div3, "class", "delete-button control-button svelte-kahisg");
    			attr_dev(div3, "role", "button");
    			attr_dev(div3, "tabindex", "0");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$7, 193, 10, 4794);
    			attr_dev(div4, "class", "buttons svelte-kahisg");
    			add_location(div4, file$7, 171, 8, 4003);
    			attr_dev(div5, "class", "control-pannel svelte-kahisg");
    			add_location(div5, file$7, 165, 6, 3882);
    			attr_dev(div6, "class", "container is-centered is-vcentered svelte-kahisg");
    			add_location(div6, file$7, 205, 6, 5154);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-kahisg");
    			add_location(img, file$7, 213, 8, 5502);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$7, 215, 12, 5621);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$7, 214, 10, 5578);
    			attr_dev(div8, "class", "annotation svelte-kahisg");
    			add_location(div8, file$7, 212, 6, 5468);
    			attr_dev(div9, "class", "box svelte-kahisg");
    			add_location(div9, file$7, 163, 4, 3855);
    			attr_dev(div10, "class", "container svelte-kahisg");
    			add_location(div10, file$7, 146, 2, 3281);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(poolanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", handleScroll$1, false, false, false, false),
    					listen_dev(div1, "keydown", /*keydown_handler*/ ctx[10], false, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[7], false, false, false, false),
    					listen_dev(div2, "keydown", /*keydown_handler_1*/ ctx[11], false, false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[9], false, false, false, false),
    					listen_dev(div3, "keydown", /*keydown_handler_2*/ ctx[12], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*isPaused*/ 16) && raw_value !== (raw_value = (/*isPaused*/ ctx[4]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const poolanimator_changes = {};
    			if (dirty & /*kernelLength*/ 2) poolanimator_changes.kernelLength = /*kernelLength*/ ctx[1];
    			if (dirty & /*input*/ 1) poolanimator_changes.image = /*input*/ ctx[0];
    			if (dirty & /*outputFinal*/ 32) poolanimator_changes.output = /*outputFinal*/ ctx[5];
    			if (dirty & /*isPaused*/ 16) poolanimator_changes.isPaused = /*isPaused*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) poolanimator_changes.dataRange = /*dataRange*/ ctx[2];
    			poolanimator.$set(poolanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(poolanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(poolanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(poolanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(146:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[3] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const dilation$1 = 1;

    function handleScroll$1() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-pooling`);
    	scroll.animateScroll(anchor);
    }

    function handleControlKeydown$2(event, callback) {
    	if (event.key === 'Enter' || event.key === ' ') {
    		event.preventDefault();
    		callback();
    	}
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Poolview', slots, []);
    	let { input } = $$props;
    	let { kernelLength } = $$props;
    	let { dataRange } = $$props;
    	let { isExited } = $$props;
    	const dispatch = createEventDispatcher();

    	// let isExited = false;
    	let stride = 2;

    	var isPaused = false;
    	var outputFinal = singleMaxPooling(input);

    	function handleClickPause() {
    		$$invalidate(4, isPaused = !isPaused);
    		console.log(isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(4, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		dispatch('message', { text: true });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console_1$1.warn("<Poolview> was created without expected prop 'input'");
    		}

    		if (kernelLength === undefined && !('kernelLength' in $$props || $$self.$$.bound[$$self.$$.props['kernelLength']])) {
    			console_1$1.warn("<Poolview> was created without expected prop 'kernelLength'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console_1$1.warn("<Poolview> was created without expected prop 'dataRange'");
    		}

    		if (isExited === undefined && !('isExited' in $$props || $$self.$$.bound[$$self.$$.props['isExited']])) {
    			console_1$1.warn("<Poolview> was created without expected prop 'isExited'");
    		}
    	});

    	const writable_props = ['input', 'kernelLength', 'dataRange', 'isExited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Poolview> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = event => handleControlKeydown$2(event, handleScroll$1);
    	const keydown_handler_1 = event => handleControlKeydown$2(event, handleClickPause);
    	const keydown_handler_2 = event => handleControlKeydown$2(event, handleClickX);

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    	};

    	$$self.$capture_state = () => ({
    		PoolAnimator,
    		singleMaxPooling,
    		createEventDispatcher,
    		input,
    		kernelLength,
    		dataRange,
    		isExited,
    		dispatch,
    		stride,
    		dilation: dilation$1,
    		isPaused,
    		outputFinal,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleScroll: handleScroll$1,
    		handleControlKeydown: handleControlKeydown$2
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('kernelLength' in $$props) $$invalidate(1, kernelLength = $$props.kernelLength);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(3, isExited = $$props.isExited);
    		if ('stride' in $$props) $$invalidate(6, stride = $$props.stride);
    		if ('isPaused' in $$props) $$invalidate(4, isPaused = $$props.isPaused);
    		if ('outputFinal' in $$props) $$invalidate(5, outputFinal = $$props.outputFinal);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*input*/ 1) {
    			// let dragging = false;
    			// let dragInfo = {x1: 0, x2: 0, y1: 0, y2: 0};
    			// let detailView = d3.select('#detailview').node();
    			 if (stride > 0) {
    				try {
    					$$invalidate(5, outputFinal = singleMaxPooling(input));
    				} catch {
    					console.log("Cannot handle stride of " + stride);
    				}
    			}
    		}
    	};

    	return [
    		input,
    		kernelLength,
    		dataRange,
    		isExited,
    		isPaused,
    		outputFinal,
    		stride,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		keydown_handler,
    		keydown_handler_1,
    		keydown_handler_2
    	];
    }

    class Poolview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			input: 0,
    			kernelLength: 1,
    			dataRange: 2,
    			isExited: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Poolview",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get input() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get kernelLength() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set kernelLength(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Poolview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Poolview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\UpsampleAnimator.svelte generated by Svelte v3.59.2 */
    const file$8 = "src\\detail-view\\UpsampleAnimator.svelte";

    function create_fragment$8(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*image*/ ctx[0].length + "";
    	let t1;
    	let t2;
    	let t3_value = /*image*/ ctx[0][0].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let dataview0;
    	let t6;
    	let div3;
    	let div2;
    	let span0;
    	let t8;
    	let dataview1;
    	let t9;
    	let span1;
    	let t11;
    	let span2;
    	let t13;
    	let dataview2;
    	let t14;
    	let div5;
    	let div4;
    	let t15;
    	let t16_value = /*output*/ ctx[1].length + "";
    	let t16;
    	let t17;
    	let t18_value = /*output*/ ctx[1][0].length + "";
    	let t18;
    	let t19;
    	let t20;
    	let dataview3;
    	let current;

    	dataview0 = new Dataview({
    			props: {
    				data: /*gridImage*/ ctx[7],
    				highlights: /*inputHighlights*/ ctx[3],
    				outputLength: /*image*/ ctx[0].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*image*/ ctx[0].length),
    				dataRange: /*dataRange*/ ctx[2],
    				stride: 1
    			},
    			$$inline: true
    		});

    	dataview0.$on("message", /*handleMouseover*/ ctx[9]);

    	dataview1 = new Dataview({
    			props: {
    				data: /*inputSlice*/ ctx[5],
    				highlights: /*outputHighlights*/ ctx[4],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview2 = new Dataview({
    			props: {
    				data: /*outputSlice*/ ctx[6],
    				highlights: /*outputHighlights*/ ctx[4],
    				isKernelMath: true,
    				constraint: 20,
    				dataRange: /*dataRange*/ ctx[2]
    			},
    			$$inline: true
    		});

    	dataview3 = new Dataview({
    			props: {
    				data: /*gridOutput*/ ctx[8],
    				highlights: /*outputHighlights*/ ctx[4],
    				outputLength: /*output*/ ctx[1].length,
    				isKernelMath: false,
    				constraint: getVisualizationSizeConstraint(/*output*/ ctx[1].length),
    				dataRange: /*dataRange*/ ctx[2],
    				stride: 1
    			},
    			$$inline: true
    		});

    	dataview3.$on("message", /*handleMouseover*/ ctx[9]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Input (");
    			t1 = text(t1_value);
    			t2 = text(", ");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			create_component(dataview0.$$.fragment);
    			t6 = space();
    			div3 = element("div");
    			div2 = element("div");
    			span0 = element("span");
    			span0.textContent = "repeat(";
    			t8 = space();
    			create_component(dataview1.$$.fragment);
    			t9 = space();
    			span1 = element("span");
    			span1.textContent = ")";
    			t11 = space();
    			span2 = element("span");
    			span2.textContent = "=";
    			t13 = space();
    			create_component(dataview2.$$.fragment);
    			t14 = space();
    			div5 = element("div");
    			div4 = element("div");
    			t15 = text("Output (");
    			t16 = text(t16_value);
    			t17 = text(", ");
    			t18 = text(t18_value);
    			t19 = text(")");
    			t20 = space();
    			create_component(dataview3.$$.fragment);
    			attr_dev(div0, "class", "header-text");
    			add_location(div0, file$8, 88, 2, 2558);
    			attr_dev(div1, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div1, file$8, 87, 0, 2516);
    			add_location(span0, file$8, 98, 4, 3024);
    			add_location(span1, file$8, 101, 4, 3180);
    			add_location(span2, file$8, 102, 4, 3201);
    			set_style(div2, "display", "flex");
    			set_style(div2, "align-items", "center");
    			set_style(div2, "justify-content", "center");
    			set_style(div2, "gap", "5px");
    			add_location(div2, file$8, 97, 2, 2934);
    			attr_dev(div3, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div3, file$8, 96, 0, 2892);
    			attr_dev(div4, "class", "header-text");
    			add_location(div4, file$8, 109, 2, 3410);
    			attr_dev(div5, "class", "column has-text-centered svelte-gz7a6i");
    			add_location(div5, file$8, 108, 0, 3368);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);
    			append_dev(div1, t5);
    			mount_component(dataview0, div1, null);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, span0);
    			append_dev(div2, t8);
    			mount_component(dataview1, div2, null);
    			append_dev(div2, t9);
    			append_dev(div2, span1);
    			append_dev(div2, t11);
    			append_dev(div2, span2);
    			append_dev(div2, t13);
    			mount_component(dataview2, div2, null);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, t15);
    			append_dev(div4, t16);
    			append_dev(div4, t17);
    			append_dev(div4, t18);
    			append_dev(div4, t19);
    			append_dev(div5, t20);
    			mount_component(dataview3, div5, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*image*/ 1) && t1_value !== (t1_value = /*image*/ ctx[0].length + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*image*/ 1) && t3_value !== (t3_value = /*image*/ ctx[0][0].length + "")) set_data_dev(t3, t3_value);
    			const dataview0_changes = {};
    			if (dirty & /*gridImage*/ 128) dataview0_changes.data = /*gridImage*/ ctx[7];
    			if (dirty & /*inputHighlights*/ 8) dataview0_changes.highlights = /*inputHighlights*/ ctx[3];
    			if (dirty & /*image*/ 1) dataview0_changes.outputLength = /*image*/ ctx[0].length;
    			if (dirty & /*image*/ 1) dataview0_changes.constraint = getVisualizationSizeConstraint(/*image*/ ctx[0].length);
    			if (dirty & /*dataRange*/ 4) dataview0_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview0.$set(dataview0_changes);
    			const dataview1_changes = {};
    			if (dirty & /*inputSlice*/ 32) dataview1_changes.data = /*inputSlice*/ ctx[5];
    			if (dirty & /*outputHighlights*/ 16) dataview1_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) dataview1_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview1.$set(dataview1_changes);
    			const dataview2_changes = {};
    			if (dirty & /*outputSlice*/ 64) dataview2_changes.data = /*outputSlice*/ ctx[6];
    			if (dirty & /*outputHighlights*/ 16) dataview2_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*dataRange*/ 4) dataview2_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview2.$set(dataview2_changes);
    			if ((!current || dirty & /*output*/ 2) && t16_value !== (t16_value = /*output*/ ctx[1].length + "")) set_data_dev(t16, t16_value);
    			if ((!current || dirty & /*output*/ 2) && t18_value !== (t18_value = /*output*/ ctx[1][0].length + "")) set_data_dev(t18, t18_value);
    			const dataview3_changes = {};
    			if (dirty & /*gridOutput*/ 256) dataview3_changes.data = /*gridOutput*/ ctx[8];
    			if (dirty & /*outputHighlights*/ 16) dataview3_changes.highlights = /*outputHighlights*/ ctx[4];
    			if (dirty & /*output*/ 2) dataview3_changes.outputLength = /*output*/ ctx[1].length;
    			if (dirty & /*output*/ 2) dataview3_changes.constraint = getVisualizationSizeConstraint(/*output*/ ctx[1].length);
    			if (dirty & /*dataRange*/ 4) dataview3_changes.dataRange = /*dataRange*/ ctx[2];
    			dataview3.$set(dataview3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dataview0.$$.fragment, local);
    			transition_in(dataview1.$$.fragment, local);
    			transition_in(dataview2.$$.fragment, local);
    			transition_in(dataview3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dataview0.$$.fragment, local);
    			transition_out(dataview1.$$.fragment, local);
    			transition_out(dataview2.$$.fragment, local);
    			transition_out(dataview3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(dataview0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div3);
    			destroy_component(dataview1);
    			destroy_component(dataview2);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div5);
    			destroy_component(dataview3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('UpsampleAnimator', slots, []);
    	let { image } = $$props;
    	let { output } = $$props;
    	let { factor = 2 } = $$props;
    	let { isPaused } = $$props;
    	let { dataRange } = $$props;
    	const dispatch = createEventDispatcher();
    	let inputHighlights = array1d(image.length * image.length, () => false);
    	let outputHighlights = array1d(output.length * output.length, () => false);
    	let inputSlice = gridData([[0]]);
    	let outputSlice = gridData([[0, 0], [0, 0]]);
    	let interval;
    	let counter = 0;

    	const updateFocus = (animatedH, animatedW) => {
    		$$invalidate(3, inputHighlights = array1d(image.length * image.length, () => false));
    		$$invalidate(4, outputHighlights = array1d(output.length * output.length, () => false));
    		$$invalidate(3, inputHighlights[animatedH * image.length + animatedW] = true, inputHighlights);
    		let outputStartH = animatedH * factor;
    		let outputStartW = animatedW * factor;

    		for (let r = 0; r < factor; r++) {
    			for (let c = 0; c < factor; c++) {
    				let outH = outputStartH + r;
    				let outW = outputStartW + c;
    				$$invalidate(4, outputHighlights[outH * output.length + outW] = true, outputHighlights);
    			}
    		}

    		$$invalidate(5, inputSlice = gridData([[image[animatedH][animatedW]]]));
    		let outPatch = [];

    		for (let r = 0; r < factor; r++) {
    			let row = [];

    			for (let c = 0; c < factor; c++) {
    				row.push(output[outputStartH + r][outputStartW + c]);
    			}

    			outPatch.push(row);
    		}

    		$$invalidate(6, outputSlice = gridData(outPatch));
    	};

    	const startAnimation = () => {
    		if (interval) clearInterval(interval);
    		counter = 0;

    		interval = setInterval(
    			() => {
    				if (isPaused) return;
    				let flatIndex = counter % (image.length * image.length);
    				let animatedH = Math.floor(flatIndex / image.length);
    				let animatedW = flatIndex % image.length;
    				updateFocus(animatedH, animatedW);
    				counter++;
    			},
    			250
    		);
    	};

    	function handleMouseover(event) {
    		let animatedH = event.detail.hoverH;
    		let animatedW = event.detail.hoverW;
    		updateFocus(animatedH, animatedW);
    		$$invalidate(10, isPaused = true);
    		dispatch('message', { text: isPaused });
    	}

    	startAnimation();
    	let gridImage = gridData(image);
    	let gridOutput = gridData(output);

    	$$self.$$.on_mount.push(function () {
    		if (image === undefined && !('image' in $$props || $$self.$$.bound[$$self.$$.props['image']])) {
    			console.warn("<UpsampleAnimator> was created without expected prop 'image'");
    		}

    		if (output === undefined && !('output' in $$props || $$self.$$.bound[$$self.$$.props['output']])) {
    			console.warn("<UpsampleAnimator> was created without expected prop 'output'");
    		}

    		if (isPaused === undefined && !('isPaused' in $$props || $$self.$$.bound[$$self.$$.props['isPaused']])) {
    			console.warn("<UpsampleAnimator> was created without expected prop 'isPaused'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<UpsampleAnimator> was created without expected prop 'dataRange'");
    		}
    	});

    	const writable_props = ['image', 'output', 'factor', 'isPaused', 'dataRange'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<UpsampleAnimator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('image' in $$props) $$invalidate(0, image = $$props.image);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('factor' in $$props) $$invalidate(11, factor = $$props.factor);
    		if ('isPaused' in $$props) $$invalidate(10, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		array1d,
    		getVisualizationSizeConstraint,
    		gridData,
    		Dataview,
    		image,
    		output,
    		factor,
    		isPaused,
    		dataRange,
    		dispatch,
    		inputHighlights,
    		outputHighlights,
    		inputSlice,
    		outputSlice,
    		interval,
    		counter,
    		updateFocus,
    		startAnimation,
    		handleMouseover,
    		gridImage,
    		gridOutput
    	});

    	$$self.$inject_state = $$props => {
    		if ('image' in $$props) $$invalidate(0, image = $$props.image);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('factor' in $$props) $$invalidate(11, factor = $$props.factor);
    		if ('isPaused' in $$props) $$invalidate(10, isPaused = $$props.isPaused);
    		if ('dataRange' in $$props) $$invalidate(2, dataRange = $$props.dataRange);
    		if ('inputHighlights' in $$props) $$invalidate(3, inputHighlights = $$props.inputHighlights);
    		if ('outputHighlights' in $$props) $$invalidate(4, outputHighlights = $$props.outputHighlights);
    		if ('inputSlice' in $$props) $$invalidate(5, inputSlice = $$props.inputSlice);
    		if ('outputSlice' in $$props) $$invalidate(6, outputSlice = $$props.outputSlice);
    		if ('interval' in $$props) interval = $$props.interval;
    		if ('counter' in $$props) counter = $$props.counter;
    		if ('gridImage' in $$props) $$invalidate(7, gridImage = $$props.gridImage);
    		if ('gridOutput' in $$props) $$invalidate(8, gridOutput = $$props.gridOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image, output*/ 3) {
    			 {
    				startAnimation();
    				$$invalidate(7, gridImage = gridData(image));
    				$$invalidate(8, gridOutput = gridData(output));
    			}
    		}
    	};

    	return [
    		image,
    		output,
    		dataRange,
    		inputHighlights,
    		outputHighlights,
    		inputSlice,
    		outputSlice,
    		gridImage,
    		gridOutput,
    		handleMouseover,
    		isPaused,
    		factor
    	];
    }

    class UpsampleAnimator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			image: 0,
    			output: 1,
    			factor: 11,
    			isPaused: 10,
    			dataRange: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UpsampleAnimator",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get image() {
    		throw new Error("<UpsampleAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<UpsampleAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<UpsampleAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<UpsampleAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get factor() {
    		throw new Error("<UpsampleAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set factor(value) {
    		throw new Error("<UpsampleAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isPaused() {
    		throw new Error("<UpsampleAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isPaused(value) {
    		throw new Error("<UpsampleAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<UpsampleAnimator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<UpsampleAnimator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\detail-view\Upsampleview.svelte generated by Svelte v3.59.2 */
    const file$9 = "src\\detail-view\\Upsampleview.svelte";

    // (101:0) {#if !isExited}
    function create_if_block$4(ctx) {
    	let div10;
    	let div9;
    	let div5;
    	let div0;
    	let t1;
    	let div4;
    	let div1;
    	let i0;
    	let t2;
    	let div2;

    	let raw_value = (/*isPaused*/ ctx[5]
    	? '<i class="fas fa-play-circle play-icon"></i>'
    	: '<i class="fas fa-pause-circle"></i>') + "";

    	let t3;
    	let div3;
    	let i1;
    	let t4;
    	let div6;
    	let upsampleanimator;
    	let t5;
    	let div8;
    	let img;
    	let img_src_value;
    	let t6;
    	let div7;
    	let span;
    	let t8;
    	let current;
    	let mounted;
    	let dispose;

    	upsampleanimator = new UpsampleAnimator({
    			props: {
    				image: /*input*/ ctx[0],
    				output: /*output*/ ctx[1],
    				factor: /*factor*/ ctx[2],
    				isPaused: /*isPaused*/ ctx[5],
    				dataRange: /*dataRange*/ ctx[3]
    			},
    			$$inline: true
    		});

    	upsampleanimator.$on("message", /*handlePauseFromInteraction*/ ctx[7]);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "Upsampling";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			i0 = element("i");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			i1 = element("i");
    			t4 = space();
    			div6 = element("div");
    			create_component(upsampleanimator.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			img = element("img");
    			t6 = space();
    			div7 = element("div");
    			span = element("span");
    			span.textContent = "Hover over";
    			t8 = text(" the matrices to inspect one repeated block.");
    			attr_dev(div0, "class", "title-text svelte-1xdunlq");
    			add_location(div0, file$9, 104, 8, 2088);
    			attr_dev(i0, "class", "fas fa-info-circle");
    			add_location(i0, file$9, 115, 12, 2451);
    			attr_dev(div1, "class", "control-button svelte-1xdunlq");
    			attr_dev(div1, "role", "button");
    			attr_dev(div1, "tabindex", "0");
    			attr_dev(div1, "title", "Jump to article section");
    			add_location(div1, file$9, 109, 10, 2195);
    			attr_dev(div2, "class", "play-button control-button svelte-1xdunlq");
    			attr_dev(div2, "role", "button");
    			attr_dev(div2, "tabindex", "0");
    			attr_dev(div2, "title", "Play animation");
    			add_location(div2, file$9, 118, 10, 2517);
    			attr_dev(i1, "class", "fas control-icon fa-times-circle");
    			add_location(i1, file$9, 135, 12, 3203);
    			attr_dev(div3, "class", "delete-button control-button svelte-1xdunlq");
    			attr_dev(div3, "role", "button");
    			attr_dev(div3, "tabindex", "0");
    			attr_dev(div3, "title", "Close");
    			add_location(div3, file$9, 129, 10, 2951);
    			attr_dev(div4, "class", "buttons svelte-1xdunlq");
    			add_location(div4, file$9, 108, 8, 2162);
    			attr_dev(div5, "class", "control-pannel svelte-1xdunlq");
    			add_location(div5, file$9, 103, 6, 2050);
    			attr_dev(div6, "class", "container is-centered is-vcentered svelte-1xdunlq");
    			add_location(div6, file$9, 140, 6, 3309);
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/pointer.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pointer icon");
    			attr_dev(img, "class", "svelte-1xdunlq");
    			add_location(img, file$9, 147, 8, 3594);
    			set_style(span, "font-weight", "600");
    			add_location(span, file$9, 149, 10, 3709);
    			attr_dev(div7, "class", "annotation-text");
    			add_location(div7, file$9, 148, 8, 3668);
    			attr_dev(div8, "class", "annotation svelte-1xdunlq");
    			add_location(div8, file$9, 146, 6, 3560);
    			attr_dev(div9, "class", "box svelte-1xdunlq");
    			add_location(div9, file$9, 102, 4, 2025);
    			attr_dev(div10, "class", "container svelte-1xdunlq");
    			add_location(div10, file$9, 101, 2, 1996);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, i0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			div2.innerHTML = raw_value;
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, i1);
    			append_dev(div9, t4);
    			append_dev(div9, div6);
    			mount_component(upsampleanimator, div6, null);
    			append_dev(div9, t5);
    			append_dev(div9, div8);
    			append_dev(div8, img);
    			append_dev(div8, t6);
    			append_dev(div8, div7);
    			append_dev(div7, span);
    			append_dev(div7, t8);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", handleScroll$2, false, false, false, false),
    					listen_dev(div1, "keydown", /*keydown_handler*/ ctx[9], false, false, false, false),
    					listen_dev(div2, "click", /*handleClickPause*/ ctx[6], false, false, false, false),
    					listen_dev(div2, "keydown", /*keydown_handler_1*/ ctx[10], false, false, false, false),
    					listen_dev(div3, "click", /*handleClickX*/ ctx[8], false, false, false, false),
    					listen_dev(div3, "keydown", /*keydown_handler_2*/ ctx[11], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*isPaused*/ 32) && raw_value !== (raw_value = (/*isPaused*/ ctx[5]
    			? '<i class="fas fa-play-circle play-icon"></i>'
    			: '<i class="fas fa-pause-circle"></i>') + "")) div2.innerHTML = raw_value;
    			const upsampleanimator_changes = {};
    			if (dirty & /*input*/ 1) upsampleanimator_changes.image = /*input*/ ctx[0];
    			if (dirty & /*output*/ 2) upsampleanimator_changes.output = /*output*/ ctx[1];
    			if (dirty & /*factor*/ 4) upsampleanimator_changes.factor = /*factor*/ ctx[2];
    			if (dirty & /*isPaused*/ 32) upsampleanimator_changes.isPaused = /*isPaused*/ ctx[5];
    			if (dirty & /*dataRange*/ 8) upsampleanimator_changes.dataRange = /*dataRange*/ ctx[3];
    			upsampleanimator.$set(upsampleanimator_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(upsampleanimator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(upsampleanimator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(upsampleanimator);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(101:0) {#if !isExited}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*isExited*/ ctx[4] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isExited*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isExited*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handleScroll$2() {
    	let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    	let scroll = new SmoothScroll('a[href*="#"]', { offset: -svgHeight });
    	let anchor = document.querySelector(`#article-pooling`);
    	scroll.animateScroll(anchor);
    }

    function handleControlKeydown$3(event, callback) {
    	if (event.key === 'Enter' || event.key === ' ') {
    		event.preventDefault();
    		callback();
    	}
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Upsampleview', slots, []);
    	let { input } = $$props;
    	let { output } = $$props;
    	let { factor = 2 } = $$props;
    	let { dataRange } = $$props;
    	let { isExited } = $$props;
    	const dispatch = createEventDispatcher();
    	let isPaused = false;

    	function handleClickPause() {
    		$$invalidate(5, isPaused = !isPaused);
    	}

    	function handlePauseFromInteraction(event) {
    		$$invalidate(5, isPaused = event.detail.text);
    	}

    	function handleClickX() {
    		dispatch('message', { text: true });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console.warn("<Upsampleview> was created without expected prop 'input'");
    		}

    		if (output === undefined && !('output' in $$props || $$self.$$.bound[$$self.$$.props['output']])) {
    			console.warn("<Upsampleview> was created without expected prop 'output'");
    		}

    		if (dataRange === undefined && !('dataRange' in $$props || $$self.$$.bound[$$self.$$.props['dataRange']])) {
    			console.warn("<Upsampleview> was created without expected prop 'dataRange'");
    		}

    		if (isExited === undefined && !('isExited' in $$props || $$self.$$.bound[$$self.$$.props['isExited']])) {
    			console.warn("<Upsampleview> was created without expected prop 'isExited'");
    		}
    	});

    	const writable_props = ['input', 'output', 'factor', 'dataRange', 'isExited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Upsampleview> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = event => handleControlKeydown$3(event, handleScroll$2);
    	const keydown_handler_1 = event => handleControlKeydown$3(event, handleClickPause);
    	const keydown_handler_2 = event => handleControlKeydown$3(event, handleClickX);

    	$$self.$$set = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('factor' in $$props) $$invalidate(2, factor = $$props.factor);
    		if ('dataRange' in $$props) $$invalidate(3, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(4, isExited = $$props.isExited);
    	};

    	$$self.$capture_state = () => ({
    		UpsampleAnimator,
    		createEventDispatcher,
    		input,
    		output,
    		factor,
    		dataRange,
    		isExited,
    		dispatch,
    		isPaused,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		handleScroll: handleScroll$2,
    		handleControlKeydown: handleControlKeydown$3
    	});

    	$$self.$inject_state = $$props => {
    		if ('input' in $$props) $$invalidate(0, input = $$props.input);
    		if ('output' in $$props) $$invalidate(1, output = $$props.output);
    		if ('factor' in $$props) $$invalidate(2, factor = $$props.factor);
    		if ('dataRange' in $$props) $$invalidate(3, dataRange = $$props.dataRange);
    		if ('isExited' in $$props) $$invalidate(4, isExited = $$props.isExited);
    		if ('isPaused' in $$props) $$invalidate(5, isPaused = $$props.isPaused);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		input,
    		output,
    		factor,
    		dataRange,
    		isExited,
    		isPaused,
    		handleClickPause,
    		handlePauseFromInteraction,
    		handleClickX,
    		keydown_handler,
    		keydown_handler_1,
    		keydown_handler_2
    	];
    }

    class Upsampleview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			input: 0,
    			output: 1,
    			factor: 2,
    			dataRange: 3,
    			isExited: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Upsampleview",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get input() {
    		throw new Error("<Upsampleview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Upsampleview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get output() {
    		throw new Error("<Upsampleview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set output(value) {
    		throw new Error("<Upsampleview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get factor() {
    		throw new Error("<Upsampleview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set factor(value) {
    		throw new Error("<Upsampleview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dataRange() {
    		throw new Error("<Upsampleview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataRange(value) {
    		throw new Error("<Upsampleview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isExited() {
    		throw new Error("<Upsampleview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isExited(value) {
    		throw new Error("<Upsampleview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\overview\Modal.svelte generated by Svelte v3.59.2 */
    const file$a = "src\\overview\\Modal.svelte";

    function create_fragment$a(ctx) {
    	let div9;
    	let div8;
    	let div0;
    	let t0;
    	let div7;
    	let header;
    	let p;
    	let t2;
    	let button0;
    	let t3;
    	let section;
    	let div4;
    	let div1;
    	let input0;
    	let t4;
    	let span0;
    	let i0;
    	let t5;
    	let div2;
    	let t7;
    	let div3;
    	let label;
    	let input1;
    	let t8;
    	let span3;
    	let span1;
    	let i1;
    	let t9;
    	let span2;
    	let t11;
    	let footer;
    	let div5;
    	let t12_value = /*errorInfo*/ ctx[5].error + "";
    	let t12;
    	let t13;
    	let div6;
    	let button1;
    	let t15;
    	let button2;
    	let t17;
    	let img;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div8 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div7 = element("div");
    			header = element("header");
    			p = element("p");
    			p.textContent = "Add Input Image";
    			t2 = space();
    			button0 = element("button");
    			t3 = space();
    			section = element("section");
    			div4 = element("div");
    			div1 = element("div");
    			input0 = element("input");
    			t4 = space();
    			span0 = element("span");
    			i0 = element("i");
    			t5 = space();
    			div2 = element("div");
    			div2.textContent = "or";
    			t7 = space();
    			div3 = element("div");
    			label = element("label");
    			input1 = element("input");
    			t8 = space();
    			span3 = element("span");
    			span1 = element("span");
    			i1 = element("i");
    			t9 = space();
    			span2 = element("span");
    			span2.textContent = "Upload";
    			t11 = space();
    			footer = element("footer");
    			div5 = element("div");
    			t12 = text(t12_value);
    			t13 = space();
    			div6 = element("div");
    			button1 = element("button");
    			button1.textContent = "Cancel";
    			t15 = space();
    			button2 = element("button");
    			button2.textContent = "Add";
    			t17 = space();
    			img = element("img");
    			attr_dev(div0, "class", "modal-background");
    			attr_dev(div0, "role", "button");
    			attr_dev(div0, "tabindex", "0");
    			attr_dev(div0, "aria-label", "Close modal");
    			add_location(div0, file$a, 158, 4, 3615);
    			attr_dev(p, "class", "modal-card-title svelte-1o5lxfe");
    			add_location(p, file$a, 167, 8, 3912);
    			attr_dev(button0, "class", "delete");
    			attr_dev(button0, "aria-label", "close");
    			add_location(button0, file$a, 168, 8, 3969);
    			attr_dev(header, "class", "modal-card-head svelte-1o5lxfe");
    			add_location(header, file$a, 166, 6, 3870);
    			attr_dev(input0, "class", "input small-font svelte-1o5lxfe");
    			attr_dev(input0, "type", "url");
    			attr_dev(input0, "placeholder", "Paste URL of image...");
    			add_location(input0, file$a, 176, 12, 4241);
    			attr_dev(i0, "class", "fas fa-link");
    			add_location(i0, file$a, 181, 14, 4444);
    			attr_dev(span0, "class", "icon small-font is-left svelte-1o5lxfe");
    			add_location(span0, file$a, 180, 12, 4390);
    			attr_dev(div1, "class", "control has-icons-left svelte-1o5lxfe");
    			toggle_class(div1, "is-loading", /*showLoading*/ ctx[3]);
    			add_location(div1, file$a, 173, 10, 4145);
    			attr_dev(div2, "class", "or-label svelte-1o5lxfe");
    			add_location(div2, file$a, 186, 10, 4526);
    			attr_dev(input1, "class", "file-input");
    			attr_dev(input1, "type", "file");
    			attr_dev(input1, "name", "image");
    			attr_dev(input1, "accept", ".png,.jpeg,.tiff,.jpg,.png");
    			add_location(input1, file$a, 190, 14, 4644);
    			attr_dev(i1, "class", "fas fa-upload");
    			add_location(i1, file$a, 196, 18, 4937);
    			attr_dev(span1, "class", "file-icon");
    			add_location(span1, file$a, 195, 16, 4893);
    			attr_dev(span2, "class", "file-label");
    			add_location(span2, file$a, 198, 16, 5009);
    			attr_dev(span3, "class", "file-cta small-font svelte-1o5lxfe");
    			add_location(span3, file$a, 194, 14, 4841);
    			attr_dev(label, "class", "file-label");
    			add_location(label, file$a, 189, 12, 4602);
    			attr_dev(div3, "class", "file");
    			add_location(div3, file$a, 188, 10, 4570);
    			attr_dev(div4, "class", "field svelte-1o5lxfe");
    			add_location(div4, file$a, 172, 8, 4114);
    			attr_dev(section, "class", "modal-card-body");
    			add_location(section, file$a, 171, 6, 4071);
    			attr_dev(div5, "class", "error-message svelte-1o5lxfe");
    			toggle_class(div5, "hidden", !/*errorInfo*/ ctx[5].show);
    			add_location(div5, file$a, 211, 8, 5240);
    			attr_dev(button1, "class", "button is-smaller svelte-1o5lxfe");
    			add_location(button1, file$a, 217, 10, 5408);
    			attr_dev(button2, "class", "button is-success is-smaller svelte-1o5lxfe");
    			add_location(button2, file$a, 222, 10, 5534);
    			attr_dev(div6, "class", "button-container");
    			add_location(div6, file$a, 216, 8, 5366);
    			attr_dev(footer, "class", "modal-card-foot svelte-1o5lxfe");
    			add_location(footer, file$a, 209, 6, 5196);
    			attr_dev(div7, "class", "modal-card svelte-1o5lxfe");
    			add_location(div7, file$a, 165, 4, 3838);
    			attr_dev(div8, "class", "modal");
    			attr_dev(div8, "id", "input-modal");
    			toggle_class(div8, "is-active", /*modalInfo*/ ctx[6].show);
    			add_location(div8, file$a, 154, 2, 3528);
    			set_style(img, "display", "none");
    			attr_dev(img, "id", "vali-image");
    			attr_dev(img, "alt", "");
    			attr_dev(img, "aria-hidden", "true");
    			add_location(img, file$a, 235, 2, 5790);
    			attr_dev(div9, "class", "modal-component");
    			add_location(div9, file$a, 151, 0, 3463);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div8);
    			append_dev(div8, div0);
    			append_dev(div8, t0);
    			append_dev(div8, div7);
    			append_dev(div7, header);
    			append_dev(header, p);
    			append_dev(header, t2);
    			append_dev(header, button0);
    			append_dev(div7, t3);
    			append_dev(div7, section);
    			append_dev(section, div4);
    			append_dev(div4, div1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*inputValue*/ ctx[2]);
    			append_dev(div1, t4);
    			append_dev(div1, span0);
    			append_dev(span0, i0);
    			append_dev(div4, t5);
    			append_dev(div4, div2);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div3, label);
    			append_dev(label, input1);
    			append_dev(label, t8);
    			append_dev(label, span3);
    			append_dev(span3, span1);
    			append_dev(span1, i1);
    			append_dev(span3, t9);
    			append_dev(span3, span2);
    			append_dev(div7, t11);
    			append_dev(div7, footer);
    			append_dev(footer, div5);
    			append_dev(div5, t12);
    			append_dev(footer, t13);
    			append_dev(footer, div6);
    			append_dev(div6, button1);
    			append_dev(div6, t15);
    			append_dev(div6, button2);
    			append_dev(div9, t17);
    			append_dev(div9, img);
    			/*img_binding*/ ctx[16](img);
    			/*div9_binding*/ ctx[17](div9);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*crossClicked*/ ctx[10], false, false, false, false),
    					listen_dev(div0, "keydown", /*keydown_handler*/ ctx[13], false, false, false, false),
    					listen_dev(button0, "click", /*crossClicked*/ ctx[10], false, false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[14]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[15]),
    					listen_dev(input1, "change", /*imageUpload*/ ctx[9], false, false, false, false),
    					listen_dev(button1, "click", /*crossClicked*/ ctx[10], false, false, false, false),
    					listen_dev(button2, "click", /*addClicked*/ ctx[11], false, false, false, false),
    					listen_dev(img, "error", /*errorCallback*/ ctx[7], false, false, false, false),
    					listen_dev(img, "load", /*loadCallback*/ ctx[8], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*inputValue*/ 4 && input0.value !== /*inputValue*/ ctx[2]) {
    				set_input_value(input0, /*inputValue*/ ctx[2]);
    			}

    			if (dirty & /*showLoading*/ 8) {
    				toggle_class(div1, "is-loading", /*showLoading*/ ctx[3]);
    			}

    			if (dirty & /*errorInfo*/ 32 && t12_value !== (t12_value = /*errorInfo*/ ctx[5].error + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*errorInfo*/ 32) {
    				toggle_class(div5, "hidden", !/*errorInfo*/ ctx[5].show);
    			}

    			if (dirty & /*modalInfo*/ 64) {
    				toggle_class(div8, "is-active", /*modalInfo*/ ctx[6].show);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    			/*img_binding*/ ctx[16](null);
    			/*div9_binding*/ ctx[17](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, []);
    	let modalComponent;
    	let valiImg;
    	let inputValue = '';
    	let showLoading = false;
    	let files;
    	let usingURL = true;
    	let errorInfo = { show: false, error: '' };
    	const dispatch = createEventDispatcher();
    	let modalInfo = { show: false };
    	modalStore.set(modalInfo);

    	modalStore.subscribe(value => {
    		$$invalidate(6, modalInfo = value);
    	});

    	const errorCallback = () => {
    		// The URL is invalid, show an error message on the UI
    		$$invalidate(3, showLoading = false);

    		$$invalidate(5, errorInfo.show = true, errorInfo);

    		$$invalidate(
    			5,
    			errorInfo.error = usingURL
    			? "We can't find the image at that URL."
    			: "Not a valid image file.",
    			errorInfo
    		);
    	};

    	const loadCallback = () => {
    		// The URL is valid, but we are not sure if loading it to canvas would be
    		// blocked by crossOrigin setting. Try it here before dispatch to parent.
    		// https://stackoverflow.com/questions/13674835/canvas-tainted-by-cross-origin-data
    		let canvas = document.createElement("canvas");

    		let context = canvas.getContext("2d");
    		canvas.width = valiImg.width;
    		canvas.height = valiImg.height;
    		context.drawImage(valiImg, 0, 0);

    		try {
    			context.getImageData(0, 0, valiImg.width, valiImg.height);

    			// If the foreign image does support CORS -> use this image
    			// dispatch to parent component to use the input image
    			$$invalidate(3, showLoading = false);

    			$$invalidate(6, modalInfo.show = false, modalInfo);
    			modalStore.set(modalInfo);
    			dispatch('urlTyped', { url: valiImg.src });
    			$$invalidate(2, inputValue = null);
    		} catch(err) {
    			// If the foreign image does not support CORS -> use this image
    			$$invalidate(3, showLoading = false);

    			$$invalidate(5, errorInfo.show = true, errorInfo);
    			$$invalidate(5, errorInfo.error = "No permission to load this image.", errorInfo);
    		}
    	};

    	const imageUpload = () => {
    		usingURL = false;
    		let reader = new FileReader();

    		reader.onload = event => {
    			$$invalidate(1, valiImg.src = event.target.result, valiImg);
    		};

    		reader.readAsDataURL(files[0]);
    	};

    	const crossClicked = () => {
    		$$invalidate(6, modalInfo.show = false, modalInfo);
    		modalStore.set(modalInfo);

    		// Dispatch the parent component
    		dispatch('xClicked', { preImage: modalInfo.preImage });
    	};

    	const addClicked = () => {
    		// Validate the input URL
    		$$invalidate(3, showLoading = true);

    		$$invalidate(5, errorInfo.show = false, errorInfo);
    		$$invalidate(1, valiImg.crossOrigin = "Anonymous", valiImg);
    		$$invalidate(1, valiImg.src = inputValue, valiImg);
    	};

    	const handleKeyboardActivate = (event, callback) => {
    		if (event.key === 'Enter' || event.key === ' ') {
    			event.preventDefault();
    			callback();
    		}
    	};

    	onMount(() => {
    		let modal = d3.select(modalComponent).select('#input-modal');
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = event => handleKeyboardActivate(event, crossClicked);

    	function input0_input_handler() {
    		inputValue = this.value;
    		$$invalidate(2, inputValue);
    	}

    	function input1_change_handler() {
    		files = this.files;
    		$$invalidate(4, files);
    	}

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			valiImg = $$value;
    			$$invalidate(1, valiImg);
    		});
    	}

    	function div9_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			modalComponent = $$value;
    			$$invalidate(0, modalComponent);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		modalStore,
    		modalComponent,
    		valiImg,
    		inputValue,
    		showLoading,
    		files,
    		usingURL,
    		errorInfo,
    		dispatch,
    		modalInfo,
    		errorCallback,
    		loadCallback,
    		imageUpload,
    		crossClicked,
    		addClicked,
    		handleKeyboardActivate
    	});

    	$$self.$inject_state = $$props => {
    		if ('modalComponent' in $$props) $$invalidate(0, modalComponent = $$props.modalComponent);
    		if ('valiImg' in $$props) $$invalidate(1, valiImg = $$props.valiImg);
    		if ('inputValue' in $$props) $$invalidate(2, inputValue = $$props.inputValue);
    		if ('showLoading' in $$props) $$invalidate(3, showLoading = $$props.showLoading);
    		if ('files' in $$props) $$invalidate(4, files = $$props.files);
    		if ('usingURL' in $$props) usingURL = $$props.usingURL;
    		if ('errorInfo' in $$props) $$invalidate(5, errorInfo = $$props.errorInfo);
    		if ('modalInfo' in $$props) $$invalidate(6, modalInfo = $$props.modalInfo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		modalComponent,
    		valiImg,
    		inputValue,
    		showLoading,
    		files,
    		errorInfo,
    		modalInfo,
    		errorCallback,
    		loadCallback,
    		imageUpload,
    		crossClicked,
    		addClicked,
    		handleKeyboardActivate,
    		keydown_handler,
    		input0_input_handler,
    		input1_change_handler,
    		img_binding,
    		div9_binding
    	];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* global tf */

    // Default network input image size (can be overridden by model input shape)
    const defaultInputSize = 28;

    // Enum of node types
    const nodeType = {
      INPUT: 'input',
      CONV: 'conv',
      POOL: 'pool',
      RELU: 'relu',
      FC: 'fc',
      FLATTEN: 'flatten',
      BOTTLENECK: 'bottleneck',
      UPSAMPLE: 'upsample',
      RESHAPE: 'reshape',
      SIGMOID: 'sigmoid',
      OUTPUT: 'output'
    };

    class Node {
      /**
       * Class structure for each neuron node.
       * 
       * @param {string} layerName Name of the node's layer.
       * @param {int} index Index of this node in its layer.
       * @param {string} type Node type {input, conv, pool, relu, fc}. 
       * @param {number} bias The bias assocated to this node.
       * @param {number[]} output Output of this node.
       */
      constructor(layerName, index, type, bias, output) {
        this.layerName = layerName;
        this.index = index;
        this.type = type;
        this.bias = bias;
        this.output = output;

        // Weights are stored in the links
        this.inputLinks = [];
        this.outputLinks = [];
      }
    }

    class Link {
      /**
       * Class structure for each link between two nodes.
       * 
       * @param {Node} source Source node.
       * @param {Node} dest Target node.
       * @param {number} weight Weight associated to this link. It can be a number,
       *  1D array, or 2D array.
       */
      constructor(source, dest, weight) {
        this.source = source;
        this.dest = dest;
        this.weight = weight;
      }
    }

    const isInputLayer = (layer) => {
      if (!layer) return false;
      if (layer.name === 'input_layer') return true;
      if (typeof layer.getClassName === 'function') {
        return layer.getClassName() === 'InputLayer';
      }
      return false;
    };

    const getConvWeightsByOutputInput = (layer, outputCount, inputCount) => {
      const kernel = layer.kernel.val;
      const shape = kernel.shape || [];
      if (shape.length !== 4) {
        return kernel.arraySync();
      }

      // Find axes dynamically so we can handle runtime-specific layouts
      // (e.g. HWIO, OHWI, OIHW) and always normalize to [out, in, h, w].
      const allAxes = [0, 1, 2, 3];
      let outAxis = allAxes.find(axis => shape[axis] === outputCount);
      if (outAxis === undefined) {
        outAxis = 3;
      }

      let inAxis = allAxes.find(axis => axis !== outAxis && shape[axis] === inputCount);
      if (inAxis === undefined) {
        inAxis = allAxes.find(axis => axis !== outAxis) || 2;
      }

      const spatialAxes = allAxes.filter(axis => axis !== outAxis && axis !== inAxis);
      return kernel.transpose([outAxis, inAxis, ...spatialAxes]).arraySync();
    };

    const getDenseWeightsByOutputInput = (layer, outputCount, inputCount) => {
      const kernel = layer.kernel.val;
      const shape = kernel.shape || [];

      // Case A: already [out, in]
      if (shape.length === 2 && shape[0] === outputCount && shape[1] === inputCount) {
        return kernel.arraySync();
      }

      // Case B: [in, out] -> [out, in]
      if (shape.length === 2 && shape[0] === inputCount && shape[1] === outputCount) {
        return kernel.transpose([1, 0]).arraySync();
      }

      // Fallback: preserve previous behavior.
      return kernel.transpose([1, 0]).arraySync();
    };

    const tensorToLayerArray = (tensor) => {
      let normalized = tensor;

      // Remove only the batch axis; keep singleton channel axes for grayscale outputs.
      if (normalized.shape.length > 0 && normalized.shape[0] === 1) {
        normalized = normalized.squeeze([0]);
      }

      // Convert HWC tensors to CHW so channel count maps to node count.
      if (normalized.shape.length === 3) {
        normalized = normalized.transpose([2, 0, 1]);
      }

      return normalized.arraySync();
    };

    /**
     * Construct a CNN with given extracted outputs from every layer.
     * 
     * @param {number[][]} allOutputs Array of outputs for each layer.
     *  allOutputs[i][j] is the output for layer i node j.
     * @param {Model} model Loaded tf.js model.
     * @param {Tensor} inputImageTensor Loaded input image tensor.
     */
    const constructCNNFromOutputs = (allOutputs, model, inputImageTensor) => {
      let cnn = [];

      // Add the first layer (input layer)
      let inputLayer = [];
      let inputShape = model.layers[0].batchInputShape.slice(1);
      let inputImageArray = inputImageTensor.transpose([2, 0, 1]).arraySync();

      // First layer's three nodes' outputs are the channels of inputImageArray
      for (let i = 0; i < inputShape[2]; i++) {
        let node = new Node('input', i, nodeType.INPUT, 0, inputImageArray[i]);
        inputLayer.push(node);
      }
                                                                                                                       
      cnn.push(inputLayer);
      let curLayerIndex = 1;

      let outputLayerIndex = 0;
      for (let l = 0; l < model.layers.length; l++) {
        let layer = model.layers[l];
        if (isInputLayer(layer)) {
          continue;
        }
        // Get the current output
        let outputs = tensorToLayerArray(allOutputs[outputLayerIndex]);
        outputLayerIndex += 1;

        let curLayerNodes = [];
        let curLayerType;

        // Identify layer type based on the layer name
        if (layer.name.includes('conv')) {
          curLayerType = nodeType.CONV;
        } else if (layer.name.includes('max_pool') || layer.name.includes('pool')) {
          curLayerType = nodeType.POOL;
        } else if (layer.name.includes('relu')) {
          curLayerType = nodeType.RELU;
        } else if (layer.name === 'flatten') {
          curLayerType = nodeType.FLATTEN;
        } else if (layer.name === 'bottleneck') {
          curLayerType = nodeType.BOTTLENECK;
        } else if (layer.name === 'fc_layer' || layer.name.includes('dense')) {
          curLayerType = nodeType.FC;
        } else if (layer.name === 'unflatten' || layer.name.includes('reshape')) {
          curLayerType = nodeType.RESHAPE;
        } else if (layer.name.includes('upsample')) {
          curLayerType = nodeType.UPSAMPLE;
        } else if (layer.name.includes('sigmoid')) {
          curLayerType = nodeType.SIGMOID;
        } else if (layer.name === 'output') {
          curLayerType = nodeType.OUTPUT;
        } else {
          // Default to point-wise pass-through so unknown activation layers still render.
          curLayerType = nodeType.OUTPUT;
        }

        // Construct this layer based on its layer type
        switch (curLayerType) {
          case nodeType.CONV: {
            let biases = layer.bias.val.arraySync();
            let weights = getConvWeightsByOutputInput(
              layer,
              outputs.length,
              cnn[curLayerIndex - 1].length
            );

            // Add nodes into this layer
            for (let i = 0; i < outputs.length; i++) {
              let node = new Node(layer.name, i, curLayerType, biases[i],
                outputs[i]);

              // Connect this node to all previous nodes (create links)
              // CONV layers have weights in links. Links are one-to-multiple.
              let prevNodeCount = cnn[curLayerIndex - 1].length;
              let availableInputs = (weights[i] || []).length;
              let linkCount = Math.min(prevNodeCount, availableInputs);
              for (let j = 0; j < linkCount; j++) {
                let preNode = cnn[curLayerIndex - 1][j];
                let curLink = new Link(preNode, node, weights[i][j]);
                preNode.outputLinks.push(curLink);
                node.inputLinks.push(curLink);
              }
              curLayerNodes.push(node);
            }
            break;
          }
          case nodeType.BOTTLENECK:
          case nodeType.FC: {
            let biases = layer.bias.val.arraySync();
            let weights = getDenseWeightsByOutputInput(
              layer,
              outputs.length,
              cnn[curLayerIndex - 1].length
            );

            // Add nodes into this layer
            for (let i = 0; i < outputs.length; i++) {
              let node = new Node(layer.name, i, curLayerType, biases[i],
                outputs[i]);

              // Connect this node to all previous nodes (create links)
              // FC layers have weights in links. Links are one-to-multiple.

              // Track weighted input before bias-add for dense contribution views.
              let curWeightedInput = 0;
              let prevNodeCount = cnn[curLayerIndex - 1].length;
              let availableInputs = (weights[i] || []).length;
              let linkCount = Math.min(prevNodeCount, availableInputs);
              for (let j = 0; j < linkCount; j++) {
                let preNode = cnn[curLayerIndex - 1][j];
                let curLink = new Link(preNode, node, weights[i][j]);
                preNode.outputLinks.push(curLink);
                node.inputLinks.push(curLink);
                curWeightedInput += preNode.output * weights[i][j];
              }
              node.weightedInput = curWeightedInput;
              node.afterBias = curWeightedInput + biases[i];
              curLayerNodes.push(node);
            }

            // Sort flatten layer based on the node TF index
            cnn[curLayerIndex - 1].sort((a, b) => a.realIndex - b.realIndex);
            break;
          }
          case nodeType.RELU:
          case nodeType.POOL:
          case nodeType.SIGMOID:
          case nodeType.UPSAMPLE:
          case nodeType.OUTPUT: {
            // RELU and POOL have no bias nor weight
            let bias = 0;
            let weight = null;

            // Add nodes into this layer
            for (let i = 0; i < outputs.length; i++) {
              let curOutput = outputs[i];

              let node = new Node(layer.name, i, curLayerType, bias, curOutput);

              // RELU and POOL layers have no weights. Links are one-to-one
              let preNode = cnn[curLayerIndex - 1][i];
              let link = new Link(preNode, node, weight);
              preNode.outputLinks.push(link);
              node.inputLinks.push(link);

              curLayerNodes.push(node);
            }
            break;
          }
          case nodeType.RESHAPE: {
            // Unflatten converts a vector into channel feature maps.
            let bias = 0;
            let preLayer = cnn[curLayerIndex - 1];

            for (let i = 0; i < outputs.length; i++) {
              let node = new Node(layer.name, i, curLayerType, bias, outputs[i]);
              let mapHeight = outputs[i].length;
              let mapWidth = outputs[i][0].length;
              let mapSize = mapHeight * mapWidth;
              let vectorStart = i * mapSize;

              // Each reshape channel gets exactly mapSize predecessors from fc_layer.
              for (let j = 0; j < mapSize; j++) {
                let preNodeIndex = vectorStart + j;
                let row = Math.floor(j / mapWidth);
                let col = j % mapWidth;
                let preNode = preLayer[preNodeIndex];
                let link = new Link(preNode, node, [row, col, preNodeIndex]);
                preNode.outputLinks.push(link);
                node.inputLinks.push(link);
              }
              curLayerNodes.push(node);
            }
            break;
          }
          case nodeType.FLATTEN: {
            // Flatten layer has no bias nor weights.
            let bias = 0;

            for (let i = 0; i < outputs.length; i++) {
              // Flatten layer has no weights. Links are multiple-to-one.
              // Use dummy weights to store the corresponding entry in the previsou
              // node as (row, column)
              // The flatten() in tf2.keras has order: channel -> row -> column
              let preNodeWidth = cnn[curLayerIndex - 1][0].output.length,
                preNodeNum = cnn[curLayerIndex - 1].length,
                preNodeIndex = i % preNodeNum,
                preNodeRow = Math.floor(Math.floor(i / preNodeNum) / preNodeWidth),
                preNodeCol = Math.floor(i / preNodeNum) % preNodeWidth,
                // Use channel, row, colume to compute the real index with order
                // row -> column -> channel
                curNodeRealIndex = preNodeIndex * (preNodeWidth * preNodeWidth) +
                  preNodeRow * preNodeWidth + preNodeCol;
              
              let node = new Node(layer.name, i, curLayerType,
                  bias, outputs[i]);
              
              // TF uses the (i) index for computation, but the real order should
              // be (curNodeRealIndex). We will sort the nodes using the real order
              // after we compute the logits in the output layer.
              node.realIndex = curNodeRealIndex;

              let link = new Link(cnn[curLayerIndex - 1][preNodeIndex],
                  node, [preNodeRow, preNodeCol]);

              cnn[curLayerIndex - 1][preNodeIndex].outputLinks.push(link);
              node.inputLinks.push(link);

              curLayerNodes.push(node);
            }

            // Sort flatten layer based on the node TF index
            curLayerNodes.sort((a, b) => a.index - b.index);
            break;
          }
          default:
            console.error('Encounter unknown layer type');
            break;
        }

        // Add current layer to the NN
        cnn.push(curLayerNodes);
        curLayerIndex++;
      }

      return cnn;
    };

    /**
     * Construct a CNN with given model and input.
     * 
     * @param {string} inputImageFile filename of input image.
     * @param {Model} model Loaded tf.js model.
     */
    const constructCNN = async (inputImageFile, model) => {
      let inputShape = model.layers[0].batchInputShape.slice(1);
      let inputSize = inputShape[0] || defaultInputSize;
      let inputChannels = inputShape[2] || 1;

      // Load the image file
      let inputImageTensor = await getInputImageArray(inputImageFile, inputSize,
        inputChannels, true);

      // Need to feed the model with a batch
      let inputImageTensorBatch = tf.stack([inputImageTensor]);

      // To get intermediate layer outputs, we will iterate through all layers in
      // the model, and sequencially apply transformations.
      let preTensor = inputImageTensorBatch;
      let outputs = [];

      // Iterate through all layers, and build one model with that layer as output
      for (let l = 0; l < model.layers.length; l++) {
        if (isInputLayer(model.layers[l])) {
          continue;
        }
        let curTensor = model.layers[l].apply(preTensor);

        // Keep raw layer tensors and normalize shape in one place.
        outputs.push(curTensor);

        // Update preTensor for next nesting iteration
        preTensor = curTensor;
      }

      let cnn = constructCNNFromOutputs(outputs, model, inputImageTensor);
      return cnn;
    };

    /**
     * Convert canvas image data into a 3D tensor with dimension [height, width, 3].
     * Recall that tensorflow uses NHWC order (batch, height, width, channel).
     * Each pixel is in 0-255 scale.
     * 
     * @param {[int8]} imageData Canvas image data
     * @param {int} width Canvas image width
     * @param {int} height Canvas image height
     */
    const imageDataTo3DTensor = (imageData, width, height, channels = 1,
      normalize = true) => {
      // Create array placeholder for the 3d array
      let imageArray = tf.fill([height, width, channels], 0).arraySync();

      // Iterate through the data to fill out channel arrays above
      for (let i = 0; i < imageData.length; i++) {
        let pixelIndex = Math.floor(i / 4),
          channelIndex = i % 4,
          row = Math.floor(pixelIndex / width),
          column = pixelIndex % width;
        
        if (channels === 1 && channelIndex === 0) {
          // Grayscale conversion for MNIST-like models.
          let r = imageData[i];
          let g = imageData[i + 1];
          let b = imageData[i + 2];
          let gray = (r + g + b) / 3;
          if (normalize) {
            gray /= 255;
          }
          imageArray[row][column][0] = gray;
        } else if (channels > 1 && channelIndex < channels) {
          let curEntry = imageData[i];
          if (normalize) {
            curEntry /= 255;
          }
          imageArray[row][column][channelIndex] = curEntry;
        }
      }

      let tensor = tf.tensor3d(imageArray);
      return tensor;
    };

    /**
     * Get the 3D pixel value array of the given image file.
     * 
     * @param {string} imgFile File path to the image file
     * @returns A promise with the corresponding 3D array
     */
    const getInputImageArray = (imgFile, targetSize, channels = 1,
      normalize = true) => {
      let canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:none;';
      document.getElementsByTagName('body')[0].appendChild(canvas);
      let context = canvas.getContext('2d');

      return new Promise((resolve, reject) => {
        let inputImage = new Image();
        inputImage.crossOrigin = "Anonymous";
        inputImage.src = imgFile;
        let canvasImage;
        inputImage.onload = () => {
          canvas.width = targetSize;
          canvas.height = targetSize;
          context.drawImage(inputImage, 0, 0, targetSize, targetSize);
          canvasImage = context.getImageData(0, 0, targetSize, targetSize);
          // Get image data and convert it to a 3D array
          let imageData = canvasImage.data;
          let imageWidth = canvasImage.width;
          let imageHeight = canvasImage.height;

          // Remove this newly created canvas element
          canvas.parentNode.removeChild(canvas);

          resolve(imageDataTo3DTensor(imageData, imageWidth, imageHeight,
            channels, normalize));
        };
        inputImage.onerror = reject;
      })
    };

    /**
     * Wrapper to load a model.
     * 
     * @param {string} modelFile Filename of converted (through tensorflowjs.py)
     *  model json file.
     */
    const loadTrainedModel = (modelFile) => {
      return tf.loadLayersModel(modelFile);
    };

    /* global d3 */

    const layerColorScales$1 = {
      input: [d3.interpolateGreys, d3.interpolateGreys, d3.interpolateGreys],
      conv: d3.interpolateRdBu,
      relu: d3.interpolateRdBu,
      pool: d3.interpolateRdBu,
      upsample: d3.interpolateRdBu,
      sigmoid: d3.interpolateRdBu,
      reshape: d3.interpolateRdBu,
      fc: d3.interpolateGreys,
      bottleneck: d3.interpolateOranges,
      output: d3.interpolateGreys,
      weight: d3.interpolateBrBG,
      logit: d3.interpolateOranges
    };

    let nodeLength = 52;

    const overviewConfig = {
      nodeLength : nodeLength,
      plusSymbolRadius : nodeLength / 5,
      numLayers : 17,
      edgeOpacity : 0.8,
      edgeInitColor : 'rgb(175, 175, 175)',
      edgeHoverColor : 'rgb(130, 130, 130)',
      edgeHoverOuting : false,
      edgeStrokeWidth : 0.7,
      intermediateColor : 'rgb(175, 175, 175)',
      layerColorScales: layerColorScales$1,
      svgPaddings: {top: 25, bottom: 25, left: 50, right: 50},
      kernelRectLength: 8/3,
      gapRatio: 4,
      overlayRectOffset: 12,
      classLists: ['z0', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8', 'z9']
    };

    // Configs
    const nodeLength$1 = overviewConfig.nodeLength;
    const bottleneckValueBoxWidthRatio = 1.45;

    /**
     * Compute the [minimum, maximum] of a 1D or 2D array.
     * @param {[number]} array 
     */
    const getExtent = (array) => {
      let min = Infinity;
      let max = -Infinity;

      // Scalar
      if (array.length === undefined) {
        return [array, array];
      }

      // 1D array
      if (array[0].length === undefined) {
        for (let i = 0; i < array.length; i++) {
          if (array[i] < min) {
            min = array[i];
          } else if (array[i] > max) {
            max = array[i];
          }
        }
        return [min, max];
      }

      // 2D array
      for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array[0].length; j++) {
          if (array[i][j] < min) {
            min = array[i][j];
          } else if (array[i][j] > max) {
            max = array[i][j];
          }
        }
      }
      return [min, max];
    };

    /**
     * Return the output knot (right boundary center)
     * @param {object} point {x: x, y:y}
     */
    const getOutputKnot = (point) => {
      return {
        x: point.x + nodeLength$1,
        y: point.y + nodeLength$1 / 2
      };
    };

    /**
     * Return the output knot (left boundary center)
     * @param {object} point {x: x, y:y}
     */
    const getInputKnot = (point) => {
      return {
        x: point.x,
        y: point.y + nodeLength$1 / 2
      }
    };

    /**
     * Compute edge data
     * @param {[[[number, number]]]} nodeCoordinate Constructed neuron svg locations
     * @param {[object]} cnn Constructed CNN model
     */
    const getLinkData = (nodeCoordinate, cnn) => {
      const getBoxCenterY = (point) => {
        return point.y + nodeLength$1 / 2;
      };

      const getNodeOutputKnot = (point, node) => {
        if (node && node.layerName === 'bottleneck') {
          let boxWidth = nodeLength$1 * bottleneckValueBoxWidthRatio;
          return {
            x: point.x + nodeLength$1 / 2 + boxWidth / 2,
            y: getBoxCenterY(point)
          };
        }
        return getOutputKnot(point);
      };

      const getNodeInputKnot = (point, node) => {
        if (node && node.layerName === 'bottleneck') {
          let boxWidth = nodeLength$1 * bottleneckValueBoxWidthRatio;
          return {
            x: point.x + nodeLength$1 / 2 - boxWidth / 2,
            y: getBoxCenterY(point)
          };
        }
        return getInputKnot(point);
      };

      let linkData = [];
      // Create links backward (starting for the first conv layer)
      for (let l = 1; l < cnn.length; l++) {
        for (let n = 0; n < cnn[l].length; n++) {
          let isBottleneck = cnn[l][n].layerName === 'bottleneck';
          let isUnflatten = cnn[l][n].layerName === 'unflatten';
          let curTarget = getNodeInputKnot(nodeCoordinate[l][n], cnn[l][n]);
          for (let p = 0; p < cnn[l][n].inputLinks.length; p++) {
            // Handle hidden flatten/fc layers in AE overview.
            let inputNodeIndex = cnn[l][n].inputLinks[p].source.index;
            
            if (isBottleneck) {
              let flattenDimension = cnn[l-1][0].output.length *
                cnn[l-1][0].output.length;
              if (inputNodeIndex % flattenDimension !== 0){
                  continue;
              }
              inputNodeIndex = Math.floor(inputNodeIndex / flattenDimension);
            } else if (isUnflatten) {
              // Hidden fc layer sits between bottleneck and unflatten.
              inputNodeIndex = inputNodeIndex % cnn[l - 1].length;
            }
            let curSource = getNodeOutputKnot(nodeCoordinate[l-1][inputNodeIndex], cnn[l - 1][inputNodeIndex]);
            let curWeight = cnn[l][n].inputLinks[p].weight;
            linkData.push({
              source: curSource,
              target: curTarget,
              weight: curWeight,
              targetLayerIndex: l,
              targetNodeIndex: n,
              sourceNodeIndex: inputNodeIndex
            });
          }
        }
      }
      return linkData;
    };


    /**
     * Color scale wrapper (support artificially lighter color!)
     * @param {function} colorScale D3 color scale function
     * @param {number} range Color range (max - min)
     * @param {number} value Color value
     * @param {number} gap Tail of the color scale to skip
     */
    const gappedColorScale = (colorScale, range, value, gap) => {
      if (gap === undefined) { gap = 0; }
      let normalizedValue = (value + range / 2) / range;
      return colorScale(normalizedValue * (1 - 2 * gap) + gap);
    };

    /* global d3, SmoothScroll */

    // Configs
    const layerColorScales$2 = overviewConfig.layerColorScales;
    const nodeLength$2 = overviewConfig.nodeLength;
    const edgeOpacity = overviewConfig.edgeOpacity;
    const edgeInitColor = overviewConfig.edgeInitColor;
    const edgeStrokeWidth = overviewConfig.edgeStrokeWidth;
    const svgPaddings = overviewConfig.svgPaddings;
    const gapRatio = overviewConfig.gapRatio;
    const classLists = overviewConfig.classLists;
    const formater = d3.format('.4f');
    const headingMainFontSize = 15;
    const headingDimFontSize = 15;
    const headingCompactFontSize = 14;
    const bottleneckMainFontSize = 17;
    const bottleneckDimFontSize = 17;
    const bottleneckCompactFontSize = 16;
    const detailedHeadingToModelGap = 35;
    const compactHeadingToModelGap = 25;
    const bottleneckFeatureGapScale = 0.35;
    const bottleneckLabelToBoxGap = 7;
    const defaultBarTopOffset = 8;
    const bottleneckBarHeightRatio = 0.46;
    const bottleneckValueBoxWidthRatio$1 = 1.45;
    const defaultBarHeightRatio = 1 / 4;
    const bottleneckValueGap = 6;
    const defaultValueGap = 10;
    const bottleneckOutputValueFontSize = 15;
    const defaultOutputValueFontSize = 9;
    const bottleneckOutputTextFontSize = 13;
    const defaultOutputTextFontSize = 11;
    const clampNonNegative = (value) => Math.max(0, Number(value) || 0);
    const toUnitValue = (value) => {
      let normalized = Number(value);
      if (!Number.isFinite(normalized)) return 0;
      if (normalized > 1 || normalized < 0) {
        normalized = normalized / 255;
      }
      return Math.max(0, Math.min(1, normalized));
    };

    // Shared variables
    let svg$1 = undefined;
    svgStore.subscribe( value => {svg$1 = value;} );

    let vSpaceAroundGap = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap = value;} );

    let hSpaceAroundGap = undefined;
    hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap = value;} );

    let cnn = undefined;
    cnnStore.subscribe( value => {cnn = value;} );

    let nodeCoordinate = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate = value;} );

    let selectedScaleLevel = undefined;
    selectedScaleLevelStore.subscribe( value => {selectedScaleLevel = value;} );

    let cnnLayerRanges = undefined;
    cnnLayerRangesStore.subscribe( value => {cnnLayerRanges = value;} );

    let cnnLayerMinMax = undefined;
    cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax = value;} );

    let detailedMode = undefined;
    detailedModeStore.subscribe( value => {detailedMode = value;} );

    /**
     * Use bounded d3 data to draw one canvas
     * @param {object} d d3 data
     * @param {index} i d3 data index
     * @param {[object]} g d3 group
     * @param {number} range color range map (max - min)
     */
    const drawOutput = (d, i, g, range) => {
      let image = g[i];
      let colorScale = layerColorScales$2[d.type];
      let curLayerIndex = cnn.findIndex(layer =>
        layer[0] && layer[0].layerName === d.layerName);

      if (d.type === 'input') {
        colorScale = colorScale[d.index];
      } else if (colorScale === undefined) {
        colorScale = layerColorScales$2.conv;
      }

      // Set up a second convas in order to resize image
      let imageLength = d.output.length === undefined ? 1 : d.output.length;
      let bufferCanvas = document.createElement("canvas");
      let bufferContext = bufferCanvas.getContext("2d");
      bufferCanvas.width = imageLength;
      bufferCanvas.height = imageLength;

      // Fill image pixel array
      let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
      let imageSingleArray = imageSingle.data;

      if (imageLength === 1) {
        imageSingleArray[0] = d.output;
      } else {
        for (let i = 0; i < imageSingleArray.length; i+=4) {
          let pixeIndex = Math.floor(i / 4);
          let row = Math.floor(pixeIndex / imageLength);
          let column = pixeIndex % imageLength;
          let color = undefined;
          if (d.type === 'input' || d.type === 'fc' ) {
            color = d3.rgb(colorScale(1 - toUnitValue(d.output[row][column])));
          } else if (d.type === 'output') {
            let normalized = Number(d.output[row][column]);
            normalized = Number.isFinite(normalized) ? normalized : 0;
            normalized = Math.max(0, Math.min(1, normalized));
            color = d3.rgb(colorScale(1 - normalized));
          } else if (d.type === 'sigmoid') {
            let layerMinMax = (cnnLayerMinMax || [])[curLayerIndex] || {};
            let minVal = Number(layerMinMax.min);
            let maxVal = Number(layerMinMax.max);
            if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
              let safeRange = Math.abs(Number(range)) || 1;
              minVal = -safeRange / 2;
              maxVal = safeRange / 2;
            }
            let maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal), 1e-6);
            let normalized = (d.output[row][column] + maxAbs) / (2 * maxAbs);
            normalized = Math.max(0, Math.min(1, normalized));
            color = d3.rgb(colorScale(normalized));
          } else {
            let safeRange = Math.abs(Number(range)) || 1;
            let normalized = (d.output[row][column] + safeRange / 2) / safeRange;
            normalized = Math.max(0, Math.min(1, normalized));
            color = d3.rgb(colorScale(normalized));
          }

          imageSingleArray[i] = color.r;
          imageSingleArray[i + 1] = color.g;
          imageSingleArray[i + 2] = color.b;
          imageSingleArray[i + 3] = 255;
        }
      }

      // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
      // higher DPI by rescaling the image using canvas magic
      let largeCanvas = document.createElement('canvas');
      largeCanvas.width = nodeLength$2 * 3;
      largeCanvas.height = nodeLength$2 * 3;
      let largeCanvasContext = largeCanvas.getContext('2d');

      // Use drawImage to resize the original pixel array, and put the new image
      // (canvas) into corresponding canvas
      bufferContext.putImageData(imageSingle, 0, 0);
      largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
        0, 0, nodeLength$2 * 3, nodeLength$2 * 3);
      
      let imageDataURL = largeCanvas.toDataURL();
      d3.select(image).attr('xlink:href', imageDataURL);

      // Destory the buffer canvas
      bufferCanvas.remove();
      largeCanvas.remove();
    };

    /**
     * Draw bar chart to encode the output value
     * @param {object} d d3 data
     * @param {index} i d3 data index
     * @param {[object]} g d3 group
     * @param {function} scale map value to length
     */
    const drawOutputScore = (d, i, g, scale) => {
      let group = d3.select(g[i]);
      let layerName = d.layerName;
      if (layerName === 'bottleneck') {
        let bottleneckLayer = cnn.find(layer => layer[0] && layer[0].layerName === 'bottleneck') || [];
        let values = bottleneckLayer.map(node => Number(node.output) || 0);
        let minVal = d3.min(values);
        let maxVal = d3.max(values);
        let maxAbs = Math.max(Math.abs(minVal || 0), Math.abs(maxVal || 0), 1e-6);
        let value = Number(d.output) || 0;
        let zeroX = +group.select('text.output-text').attr('x');
        let boxWidth = nodeLength$2 * bottleneckValueBoxWidthRatio$1;
        let normalized = (value + maxAbs) / (2 * maxAbs);
        normalized = Math.max(0, Math.min(1, normalized));
        let fillColor = d3.rgb(layerColorScales$2.conv(normalized));
        let luminance = (0.299 * fillColor.r + 0.587 * fillColor.g + 0.114 * fillColor.b) / 255;
        let valueColor = luminance < 0.58 ? '#F7F7F7' : '#1F1F1F';

        group.select('line.output-zero-line')
          .style('opacity', 0);

        group.select('rect.output-rect')
          .transition('output')
          .delay(300)
          .duration(700)
          .ease(d3.easeCubicInOut)
          .attr('x', zeroX - boxWidth / 2)
          .attr('width', boxWidth)
          .style('fill', fillColor.formatRgb());

        group.select('text.output-value')
          .style('fill', valueColor)
          .text(d3.format('.3f')(value));
        return;
      }

      group.select('rect.output-rect')
        .transition('output')
        .delay(500)
        .duration(800)
        .ease(d3.easeCubicIn)
        .attr('x', +group.select('text.output-text').attr('x'))
        .attr('width', clampNonNegative(scale(d.output)));

      group.select('line.output-zero-line')
        .style('opacity', 0);

      group.select('text.output-value')
        .text(d3.format('.3f')(Number(d.output) || 0));
    };

    const drawCustomImage = (image, inputLayer) => {

      let imageWidth = image.width;
      // Set up a second convas in order to resize image
      let imageLength = inputLayer[0].output.length;
      let bufferCanvas = document.createElement("canvas");
      let bufferContext = bufferCanvas.getContext("2d");
      bufferCanvas.width = imageLength;
      bufferCanvas.height = imageLength;

      // Fill image pixel array
      let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
      let imageSingleArray = imageSingle.data;

      let hasSingleChannel = inputLayer.length === 1;

      for (let i = 0; i < imageSingleArray.length; i+=4) {
        let pixeIndex = Math.floor(i / 4);
        let row = Math.floor(pixeIndex / imageLength);
        let column = pixeIndex % imageLength;

        let red = inputLayer[0].output[row][column];
        let green = hasSingleChannel ? red : inputLayer[1].output[row][column];
        let blue = hasSingleChannel ? red : inputLayer[2].output[row][column];

        imageSingleArray[i] = red * 255;
        imageSingleArray[i + 1] = green * 255;
        imageSingleArray[i + 2] = blue * 255;
        imageSingleArray[i + 3] = 255;
      }

      // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
      // higher DPI by rescaling the image using canvas magic
      let largeCanvas = document.createElement('canvas');
      largeCanvas.width = imageWidth * 3;
      largeCanvas.height = imageWidth * 3;
      let largeCanvasContext = largeCanvas.getContext('2d');

      // Use drawImage to resize the original pixel array, and put the new image
      // (canvas) into corresponding canvas
      bufferContext.putImageData(imageSingle, 0, 0);
      largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
        0, 0, imageWidth * 3, imageWidth * 3);
      
      let imageDataURL = largeCanvas.toDataURL();
      // d3.select(image).attr('xlink:href', imageDataURL);
      image.src = imageDataURL;

      // Destory the buffer canvas
      bufferCanvas.remove();
      largeCanvas.remove();
    };

    /**
     * Create color gradient for the legend
     * @param {[object]} g d3 group
     * @param {function} colorScale Colormap
     * @param {string} gradientName Label for gradient def
     * @param {number} min Min of legend value
     * @param {number} max Max of legend value
     */
    const getLegendGradient = (g, colorScale, gradientName, min, max) => {
      if (min === undefined) { min = 0; }
      if (max === undefined) { max = 1; }
      let gradient = g.append('defs')
        .append('svg:linearGradient')
        .attr('id', `${gradientName}`)
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '100%')
        .attr('y2', '100%')
        .attr('spreadMethod', 'pad');
      let interpolation = 10;
      for (let i = 0; i < interpolation; i++) {
        let curProgress = i / (interpolation - 1);
        let curColor = colorScale(curProgress * (max - min) + min);
        gradient.append('stop')
          .attr('offset', `${curProgress * 100}%`)
          .attr('stop-color', curColor)
          .attr('stop-opacity', 1);
      }
    };

    /**
     * Draw all legends
     * @param {object} legends Parent group
     * @param {number} legendHeight Height of the legend element
     */
    const drawLegends = (legends, legendHeight) => {
      // Add local legends
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range1 = cnnLayerRanges.local[start];
        let range2 = cnnLayerRanges.local[start + 2];

        let localLegendScale1 = d3.scaleLinear()
          .range([0, 2 * nodeLength$2 + hSpaceAroundGap - 1.2])
          .domain([-range1 / 2, range1 / 2]);
        
        let localLegendScale2 = d3.scaleLinear()
          .range([0, 3 * nodeLength$2 + 2 * hSpaceAroundGap - 1.2])
          .domain([-range2 / 2, range2 / 2]);

        let localLegendAxis1 = d3.axisBottom()
          .scale(localLegendScale1)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range1 / 2, 0, range1 / 2]);
        
        let localLegendAxis2 = d3.axisBottom()
          .scale(localLegendScale2)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range2 / 2, 0, range2 / 2]);

        let localLegend1 = legends.append('g')
          .attr('class', 'legend local-legend')
          .attr('id', `local-legend-${i}-1`)
          .classed('hidden', !detailedMode || selectedScaleLevel !== 'local')
          .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

        localLegend1.append('g')
          .attr('transform', `translate(0, ${legendHeight - 3})`)
          .call(localLegendAxis1);

        localLegend1.append('rect')
          .attr('width', 2 * nodeLength$2 + hSpaceAroundGap)
          .attr('height', legendHeight)
          .style('fill', 'url(#convGradient)');

        let localLegend2 = legends.append('g')
          .attr('class', 'legend local-legend')
          .attr('id', `local-legend-${i}-2`)
          .classed('hidden', !detailedMode || selectedScaleLevel !== 'local')
          .attr('transform', `translate(${nodeCoordinate[start + 2][0].x}, ${0})`);

        localLegend2.append('g')
          .attr('transform', `translate(0, ${legendHeight - 3})`)
          .call(localLegendAxis2);

        localLegend2.append('rect')
          .attr('width', 3 * nodeLength$2 + 2 * hSpaceAroundGap)
          .attr('height', legendHeight)
          .style('fill', 'url(#convGradient)');
      }

      // Add module legends
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range = cnnLayerRanges.module[start];

        let moduleLegendScale = d3.scaleLinear()
          .range([0, 5 * nodeLength$2 + 3 * hSpaceAroundGap +
            1 * hSpaceAroundGap * gapRatio - 1.2])
          .domain([-range / 2, range / 2]);

        let moduleLegendAxis = d3.axisBottom()
          .scale(moduleLegendScale)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range / 2, -(range / 4), 0, range / 4, range / 2]);

        let moduleLegend = legends.append('g')
          .attr('class', 'legend module-legend')
          .attr('id', `module-legend-${i}`)
          .classed('hidden', !detailedMode || selectedScaleLevel !== 'module')
          .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);
        
        moduleLegend.append('g')
          .attr('transform', `translate(0, ${legendHeight - 3})`)
          .call(moduleLegendAxis);

        moduleLegend.append('rect')
          .attr('width', 5 * nodeLength$2 + 3 * hSpaceAroundGap +
            1 * hSpaceAroundGap * gapRatio)
          .attr('height', legendHeight)
          .style('fill', 'url(#convGradient)');
      }

      // Add global legends
      let start = 1;
      let range = cnnLayerRanges.global[start];

      let globalLegendScale = d3.scaleLinear()
        .range([0, 10 * nodeLength$2 + 6 * hSpaceAroundGap +
          3 * hSpaceAroundGap * gapRatio - 1.2])
        .domain([-range / 2, range / 2]);

      let globalLegendAxis = d3.axisBottom()
        .scale(globalLegendScale)
        .tickFormat(d3.format('.2f'))
        .tickValues([-range / 2, -(range / 4), 0, range / 4, range / 2]);

      let globalLegend = legends.append('g')
        .attr('class', 'legend global-legend')
        .attr('id', 'global-legend')
        .classed('hidden', !detailedMode || selectedScaleLevel !== 'global')
        .attr('transform', `translate(${nodeCoordinate[start][0].x}, ${0})`);

      globalLegend.append('g')
        .attr('transform', `translate(0, ${legendHeight - 3})`)
        .call(globalLegendAxis);

      globalLegend.append('rect')
        .attr('width', 10 * nodeLength$2 + 6 * hSpaceAroundGap +
          3 * hSpaceAroundGap * gapRatio)
        .attr('height', legendHeight)
        .style('fill', 'url(#convGradient)');


      // Add output legend
      let outputRectScale = d3.scaleLinear()
            .domain(cnnLayerRanges.output)
            .range([0, nodeLength$2 - 1.2]);

      let outputLegendAxis = d3.axisBottom()
        .scale(outputRectScale)
        .tickFormat(d3.format('.1f'))
        .tickValues([0, cnnLayerRanges.output[1]]);
      
      let outputLegend = legends.append('g')
        .attr('class', 'legend output-legend')
        .attr('id', 'output-legend')
        .classed('hidden', !detailedMode)
        .attr('transform', `translate(${nodeCoordinate[cnn.length - 1][0].x}, ${0})`);
      
      outputLegend.append('g')
        .attr('transform', `translate(0, ${legendHeight - 3})`)
        .call(outputLegendAxis);

      outputLegend.append('rect')
        .attr('width', nodeLength$2)
        .attr('height', legendHeight)
        .style('fill', 'gray');
      
      // Add input image legend
      let inputScale = d3.scaleLinear()
        .range([0, nodeLength$2 - 1.2])
        .domain([0, 1]);

      let inputLegendAxis = d3.axisBottom()
        .scale(inputScale)
        .tickFormat(d3.format('.1f'))
        .tickValues([0, 0.5, 1]);

      let inputLegend = legends.append('g')
        .attr('class', 'legend input-legend')
        .classed('hidden', !detailedMode)
        .attr('transform', `translate(${nodeCoordinate[0][0].x}, ${0})`);
      
      inputLegend.append('g')
        .attr('transform', `translate(0, ${legendHeight - 3})`)
        .call(inputLegendAxis);

      inputLegend.append('rect')
        .attr('x', 0.3)
        .attr('width', nodeLength$2 - 0.3)
        .attr('height', legendHeight)
        .attr('transform', `rotate(180, ${nodeLength$2/2}, ${legendHeight/2})`)
        .style('stroke', 'rgb(20, 20, 20)')
        .style('stroke-width', 0.3)
        .style('fill', 'url(#inputGradient)');
    };

    /**
     * Draw the overview
     * @param {number} width Width of the cnn group
     * @param {number} height Height of the cnn group
     * @param {object} cnnGroup Group to appen cnn elements to
     * @param {function} nodeMouseOverHandler Callback func for mouseOver
     * @param {function} nodeMouseLeaveHandler Callback func for mouseLeave
     * @param {function} nodeClickHandler Callback func for click
     */
    const drawCNN = (width, height, cnnGroup, nodeMouseOverHandler,
      nodeMouseLeaveHandler, nodeClickHandler) => {
      // Draw the CNN with dynamic spacing based on current visible layers.
      let gapUnits = 0;
      for (let l = 0; l < cnn.length; l++) {
        let curType = cnn[l][0].type;
        let isLongGap = curType === 'conv' || curType === 'bottleneck' ||
          cnn[l][0].layerName === 'unflatten' || curType === 'reshape';
        gapUnits += isLongGap ? gapRatio : 1;
      }
      hSpaceAroundGap = (width - nodeLength$2 * cnn.length) / gapUnits;
      hSpaceAroundGapStore.set(hSpaceAroundGap);
      let leftAccuumulatedSpace = 0;

      // Iterate through the cnn to draw nodes in each layer
      for (let l = 0; l < cnn.length; l++) {
        let curLayer = cnn[l];
        let isScalarLayer = curLayer[0].output.length === undefined;

        nodeCoordinate.push([]);

        // Compute the x coordinate of the whole layer
        // Output layer and conv layer has long gaps
        if (curLayer[0].type === 'conv' || curLayer[0].type === 'bottleneck' ||
          curLayer[0].layerName === 'unflatten' || curLayer[0].type === 'reshape') {
          leftAccuumulatedSpace += hSpaceAroundGap * gapRatio;
        } else {
          leftAccuumulatedSpace += hSpaceAroundGap;
        }

        // All nodes share the same x coordiante (left in div style)
        let left = leftAccuumulatedSpace;

        let layerGroup = cnnGroup.append('g')
          .attr('class', 'cnn-layer-group')
          .attr('id', `cnn-layer-group-${l}`);

        vSpaceAroundGap = (height - nodeLength$2 * curLayer.length) /
          (curLayer.length + 1);
        vSpaceAroundGapStore.set(vSpaceAroundGap);

        let layerGap = vSpaceAroundGap;
        if (curLayer[0].layerName === 'bottleneck') {
          layerGap *= bottleneckFeatureGapScale;
        }
        let packedLayerHeight = curLayer.length * nodeLength$2 +
          (curLayer.length + 1) * layerGap;
        let layerTopOffset = (height - packedLayerHeight) / 2;

        let nodeGroups = layerGroup.selectAll('g.node-group')
          .data(curLayer, d => d.index)
          .enter()
          .append('g')
          .attr('class', 'node-group')
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .on('click', nodeClickHandler)
          .on('mouseover', nodeMouseOverHandler)
          .on('mouseleave', nodeMouseLeaveHandler)
          .classed('node-output', isScalarLayer)
          .attr('id', (d, i) => {
            // Compute the coordinate
            // Not using transform on the group object because of a decade old
            // bug on webkit (safari)
            // https://bugs.webkit.org/show_bug.cgi?id=23113
            let top = i * nodeLength$2 + (i + 1) * layerGap + layerTopOffset;
            top += svgPaddings.top;
            nodeCoordinate[l].push({x: left, y: top});
            return `layer-${l}-node-${i}`
          });
        
        // Overwrite the mouseover and mouseleave function for output nodes to show
        // hover info in the UI
        layerGroup.selectAll('g.node-output')
          .on('mouseover', (d, i, g) => {
            nodeMouseOverHandler(d, i, g);
            hoverInfoStore.set( {show: true, text: `Output value: ${formater(d.output)}`} );
          })
          .on('mouseleave', (d, i, g) => {
            nodeMouseLeaveHandler(d, i, g);
            hoverInfoStore.set( {show: false, text: `Output value: ${formater(d.output)}`} );
          });
        
        if (!isScalarLayer) {
          // Embed raster image in these groups
          nodeGroups.append('image')
            .attr('class', 'node-image')
            .attr('width', nodeLength$2)
            .attr('height', nodeLength$2)
            .attr('x', left)
            .attr('y', (d, i) => nodeCoordinate[l][i].y);

          // Always-visible map border for all feature maps.
          nodeGroups.append('rect')
            .attr('class', 'map-border')
            .attr('width', nodeLength$2)
            .attr('height', nodeLength$2)
            .attr('x', left)
            .attr('y', (d, i) => nodeCoordinate[l][i].y)
            .style('fill', 'none')
            .style('stroke', edgeInitColor)
            .style('stroke-width', 0.9)
            .style('pointer-events', 'none');
          
          // Add a rectangle to show the border
          nodeGroups.append('rect')
            .attr('class', 'bounding')
            .attr('width', nodeLength$2)
            .attr('height', nodeLength$2)
            .attr('x', left)
            .attr('y', (d, i) => nodeCoordinate[l][i].y)
            .style('fill', 'none')
            .style('stroke', edgeInitColor)
            .style('stroke-width', 1)
            .classed('hidden', true);
        } else {
          nodeGroups.append('line')
            .attr('class', 'output-zero-line')
            .attr('x1', left + nodeLength$2 / 2)
            .attr('x2', left + nodeLength$2 / 2)
            .attr('y1', (d, i) => {
              let nodeCenterY = nodeCoordinate[l][i].y + nodeLength$2 / 2;
              let barHeight = d.layerName === 'bottleneck'
                ? nodeLength$2 * bottleneckBarHeightRatio
                : nodeLength$2 * defaultBarHeightRatio;
              let barTop = d.layerName === 'bottleneck'
                ? nodeCenterY - barHeight / 2
                : nodeCenterY + defaultBarTopOffset;
              return barTop;
            })
            .attr('y2', (d, i) => {
              let nodeCenterY = nodeCoordinate[l][i].y + nodeLength$2 / 2;
              let barHeight = d.layerName === 'bottleneck'
                ? nodeLength$2 * bottleneckBarHeightRatio
                : nodeLength$2 * defaultBarHeightRatio;
              let barTop = d.layerName === 'bottleneck'
                ? nodeCenterY - barHeight / 2
                : nodeCenterY + defaultBarTopOffset;
              return barTop + barHeight;
            })
            .style('stroke', '#9E9E9E')
            .style('stroke-width', d => d.layerName === 'bottleneck' ? 1.1 : 0.7)
            .style('opacity', 0);

          nodeGroups.append('rect')
            .attr('class', 'output-rect')
            .attr('x', left + nodeLength$2 / 2)
            .attr('y', (d, i) => {
              let nodeCenterY = nodeCoordinate[l][i].y + nodeLength$2 / 2;
              let barHeight = d.layerName === 'bottleneck'
                ? nodeLength$2 * bottleneckBarHeightRatio
                : nodeLength$2 * defaultBarHeightRatio;
              return d.layerName === 'bottleneck'
                ? nodeCenterY - barHeight / 2
                : nodeCenterY + defaultBarTopOffset;
            })
            .attr('height', d => d.layerName === 'bottleneck'
              ? nodeLength$2 * bottleneckBarHeightRatio
              : nodeLength$2 * defaultBarHeightRatio)
            .attr('width', 0)
            .style('fill', d => d.layerName === 'bottleneck' ? '#5E5E5E' : 'gray');
          nodeGroups.append('text')
            .attr('class', 'output-text')
            .attr('x', d => d.layerName === 'bottleneck' ? left + nodeLength$2 / 2 : left)
            .attr('y', (d, i) => {
              if (d.layerName !== 'bottleneck') {
                return nodeCoordinate[l][i].y + nodeLength$2 / 2;
              }
              let nodeCenterY = nodeCoordinate[l][i].y + nodeLength$2 / 2;
              let barHeight = nodeLength$2 * bottleneckBarHeightRatio;
              let barTop = nodeCenterY - barHeight / 2;
              return barTop - bottleneckLabelToBoxGap;
            })
            .style('text-anchor', d => d.layerName === 'bottleneck' ? 'middle' : 'start')
            .style('dominant-baseline', 'middle')
            .style('font-size', d => `${d.layerName === 'bottleneck' ? bottleneckOutputTextFontSize : defaultOutputTextFontSize}px`)
            .style('font-weight', '400')
            .style('fill', 'black')
            .style('opacity', d => d.layerName === 'bottleneck' ? 0.72 : 0.5)
            .text((d, i) => classLists[i] === undefined ? `z${i}` : classLists[i]);

          nodeGroups.append('text')
            .attr('class', 'output-value')
            .attr('x', left + nodeLength$2 / 2)
            .attr('y', (d, i) => {
              let nodeCenterY = nodeCoordinate[l][i].y + nodeLength$2 / 2;
              let barHeight = d.layerName === 'bottleneck'
                ? nodeLength$2 * bottleneckBarHeightRatio
                : nodeLength$2 * defaultBarHeightRatio;
              let barTop = d.layerName === 'bottleneck'
                ? nodeCenterY - barHeight / 2
                : nodeCenterY + defaultBarTopOffset;
              let valueGap = d.layerName === 'bottleneck' ? bottleneckValueGap : defaultValueGap;
              return d.layerName === 'bottleneck'
                ? barTop + barHeight / 2
                : barTop + barHeight + valueGap;
            })
            .style('text-anchor', 'middle')
            .style('dominant-baseline', d => d.layerName === 'bottleneck' ? 'middle' : 'hanging')
            .style('font-size', d => `${d.layerName === 'bottleneck' ? bottleneckOutputValueFontSize : defaultOutputValueFontSize}px`)
            .style('font-weight', d => d.layerName === 'bottleneck' ? '700' : '400')
            .style('fill', d => d.layerName === 'bottleneck' ? '#1F1F1F' : '#444')
            .text(d => d3.format('.3f')(Number(d.output) || 0));
          
          // Add annotation text to tell readers the exact output probability
          // nodeGroups.append('text')
          //   .attr('class', 'annotation-text')
          //   .attr('id', (d, i) => `output-prob-${i}`)
          //   .attr('x', left)
          //   .attr('y', (d, i) => nodeCoordinate[l][i].y + 10)
          //   .text(d => `(${d3.format('.4f')(d.output)})`);
        }
        leftAccuumulatedSpace += nodeLength$2;
      }

      // Share the nodeCoordinate
      nodeCoordinateStore.set(nodeCoordinate);

      // Compute the scale of the output score width (mapping the the node
      // width to the max output score)
      let outputRectScale = d3.scaleLinear()
            .domain(cnnLayerRanges.output)
            .range([0, nodeLength$2]);

      // Draw the canvas
      for (let l = 0; l < cnn.length; l++) {
        let range = cnnLayerRanges[selectedScaleLevel][l];
        svg$1.select(`g#cnn-layer-group-${l}`)
          .selectAll('image.node-image')
          .each((d, i, g) => drawOutput(d, i, g, range));
      }

      svg$1.selectAll('g.node-output').each(
        (d, i, g) => drawOutputScore(d, i, g, outputRectScale)
      );

      // Add layer label
      let layerNames = cnn.map(d => {
        if (d[0].output.length === undefined) {
          return {
            name: d[0].layerName,
            dimension: `(${d.length})`
          }
        } else {
          return {
            name: d[0].layerName,
            dimension: `(${d[0].output.length}, ${d[0].output.length}, ${d.length})`
          }
        }
      });

      let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
      let scroll = new SmoothScroll('a[href*="#"]', {offset: -svgHeight});
      let modelTopY = d3.min(nodeCoordinate
        .filter(layer => layer && layer[0])
        .map(layer => layer[0].y));
      if (!Number.isFinite(modelTopY)) {
        modelTopY = svgPaddings.top;
      }
      
      let detailedLabels = svg$1.selectAll('g.layer-detailed-label')
        .data(layerNames)
        .enter()
        .append('g')
        .attr('class', 'layer-detailed-label')
        .attr('id', (d, i) => `layer-detailed-label-${i}`)
        .classed('hidden', !detailedMode)
        .attr('transform', (d, i) => {
          let x = nodeCoordinate[i][0].x + nodeLength$2 / 2;
          let y = modelTopY - detailedHeadingToModelGap;
          return `translate(${x}, ${y})`;
        })
        .style('cursor', d => d.name.includes('output') ? 'default' : 'help')
        .on('click', (d) => {
          let target = '';
          if (d.name.includes('conv')) { target = 'convolution'; }
          if (d.name.includes('relu')) { target = 'relu'; }
          if (d.name.includes('max_pool')) { target = 'pooling';}
          if (d.name.includes('input')) { target = 'input';}

          // Scroll to a article element
          let anchor = document.querySelector(`#article-${target}`);
          scroll.animateScroll(anchor);
        });
      
      detailedLabels.append('title')
        .text('Move to article section');
        
      detailedLabels.append('text')
        .style('opacity', 0.7)
        .style('dominant-baseline', 'middle')
        .append('tspan')
        .style('font-size', d => `${d.name === 'bottleneck' ? bottleneckMainFontSize : headingMainFontSize}px`)
        .style('font-weight', d => d.name === 'bottleneck' ? '800' : '700')
        .text(d => d.name)
        .append('tspan')
        .style('font-size', d => `${d.name === 'bottleneck' ? bottleneckDimFontSize : headingDimFontSize}px`)
        .style('font-weight', 'normal')
        .attr('x', 0)
        .attr('dy', '1.2em')
        .text(d => d.dimension);
      
      let labels = svg$1.selectAll('g.layer-label')
        .data(layerNames)
        .enter()
        .append('g')
        .attr('class', 'layer-label')
        .attr('id', (d, i) => `layer-label-${i}`)
        .classed('hidden', detailedMode)
        .attr('transform', (d, i) => {
          let x = nodeCoordinate[i][0].x + nodeLength$2 / 2;
          let y = modelTopY - compactHeadingToModelGap;
          return `translate(${x}, ${y})`;
        })
        .style('cursor', d => d.name.includes('output') ? 'default' : 'help')
        .on('click', (d) => {
          let target = '';
          if (d.name.includes('conv')) { target = 'convolution'; }
          if (d.name.includes('relu')) { target = 'relu'; }
          if (d.name.includes('max_pool')) { target = 'pooling';}
          if (d.name.includes('input')) { target = 'input';}

          // Scroll to a article element
          let anchor = document.querySelector(`#article-${target}`);
          scroll.animateScroll(anchor);
        });
      
      labels.append('title')
        .text('Move to article section');
      
      labels.append('text')
        .style('dominant-baseline', 'middle')
        .style('opacity', 0.8)
        .style('font-size', d => `${d.name === 'bottleneck' ? bottleneckCompactFontSize : headingCompactFontSize}px`)
        .style('font-weight', d => d.name === 'bottleneck' ? '800' : '700')
        .text(d => {
          if (d.name.includes('conv')) { return 'conv' }
          if (d.name.includes('relu')) { return 'relu' }
          if (d.name.includes('max_pool')) { return 'max_pool'}
          return d.name
        });

      // Add layer color scale legends
      getLegendGradient(svg$1, layerColorScales$2.conv, 'convGradient');
      getLegendGradient(svg$1, layerColorScales$2.input[0], 'inputGradient');

      let legendHeight = 5;
      let legends = svg$1.append('g')
          .attr('class', 'color-legend')
          .attr('transform', `translate(${0}, ${
        svgPaddings.top + vSpaceAroundGap * (10) + vSpaceAroundGap +
        nodeLength$2 * 10
      })`);
      
      drawLegends(legends, legendHeight);

      // Add edges between nodes
      let linkGen = d3.linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);
      
      let linkData = getLinkData(nodeCoordinate, cnn);

      let edgeGroup = cnnGroup.append('g')
        .attr('class', 'edge-group');
      
      edgeGroup.selectAll('path.edge')
        .data(linkData)
        .enter()
        .append('path')
        .attr('class', d =>
          `edge edge-${d.targetLayerIndex} edge-${d.targetLayerIndex}-${d.targetNodeIndex}`)
        .attr('id', d => 
          `edge-${d.targetLayerIndex}-${d.targetNodeIndex}-${d.sourceNodeIndex}`)
        .attr('d', d => linkGen({source: d.source, target: d.target}))
        .style('fill', 'none')
        .style('stroke-width', edgeStrokeWidth)
        .style('opacity', edgeOpacity)
        .style('stroke', edgeInitColor);

      // Add input channel annotations
      let inputAnnotation = cnnGroup.append('g')
        .attr('class', 'input-annotation');

      if (cnn[0].length === 1) {
        inputAnnotation.append('text')
          .attr('x', nodeCoordinate[0][0].x + nodeLength$2 / 2)
          .attr('y', nodeCoordinate[0][0].y + nodeLength$2 + 5)
          .attr('class', 'annotation-text')
          .style('dominant-baseline', 'hanging')
          .style('text-anchor', 'middle')
          .style('fill', '#666')
          .text('Grayscale channel');
      } else {
        let redChannel = inputAnnotation.append('text')
          .attr('x', nodeCoordinate[0][0].x + nodeLength$2 / 2)
          .attr('y', nodeCoordinate[0][0].y + nodeLength$2 + 5)
          .attr('class', 'annotation-text')
          .style('dominant-baseline', 'hanging')
          .style('text-anchor', 'middle');
        
        redChannel.append('tspan')
          .style('dominant-baseline', 'hanging')
          .style('fill', '#C95E67')
          .text('Red');
        
        redChannel.append('tspan')
          .style('dominant-baseline', 'hanging')
          .text(' channel');

        inputAnnotation.append('text')
          .attr('x', nodeCoordinate[0][1].x + nodeLength$2 / 2)
          .attr('y', nodeCoordinate[0][1].y + nodeLength$2 + 5)
          .attr('class', 'annotation-text')
          .style('dominant-baseline', 'hanging')
          .style('text-anchor', 'middle')
          .style('fill', '#3DB665')
          .text('Green');

        inputAnnotation.append('text')
          .attr('x', nodeCoordinate[0][2].x + nodeLength$2 / 2)
          .attr('y', nodeCoordinate[0][2].y + nodeLength$2 + 5)
          .attr('class', 'annotation-text')
          .style('dominant-baseline', 'hanging')
          .style('text-anchor', 'middle')
          .style('fill', '#3F7FBC')
          .text('Blue');
      }
    };

    /**
     * Update canvas values when user changes input image
     */
    const updateCNN = () => {
      // Compute the scale of the output score width (mapping the the node
      // width to the max output score)
      let outputRectScale = d3.scaleLinear()
          .domain(cnnLayerRanges.output)
          .range([0, nodeLength$2]);

      // Rebind the cnn data to layer groups layer by layer
      for (let l = 0; l < cnn.length; l++) {
        let curLayer = cnn[l];
        let range = cnnLayerRanges[selectedScaleLevel][l];
        let layerGroup = svg$1.select(`g#cnn-layer-group-${l}`);
        let isScalarLayer = curLayer[0].output.length === undefined;

        let nodeGroups = layerGroup.selectAll('g.node-group')
          .data(curLayer);

        if (!isScalarLayer) {
          // Redraw the canvas and output node
          nodeGroups.transition('disappear')
            .duration(300)
            .ease(d3.easeCubicOut)
            .style('opacity', 0)
            .on('end', function() {
              d3.select(this)
                .select('image.node-image')
                .each((d, i, g) => drawOutput(d, i, g, range));
              d3.select(this).transition('appear')
                .duration(700)
                .ease(d3.easeCubicIn)
                .style('opacity', 1);
            });
        } else {
          nodeGroups.each(
            (d, i, g) => drawOutputScore(d, i, g, outputRectScale)
          );
        }
      }

      // Update the color scale legend
      // Local legends
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range1 = cnnLayerRanges.local[start];
        let range2 = cnnLayerRanges.local[start + 2];

        let localLegendScale1 = d3.scaleLinear()
          .range([0, 2 * nodeLength$2 + hSpaceAroundGap])
          .domain([-range1 / 2, range1 / 2]);
        
        let localLegendScale2 = d3.scaleLinear()
          .range([0, 3 * nodeLength$2 + 2 * hSpaceAroundGap])
          .domain([-range2 / 2, range2 / 2]);

        let localLegendAxis1 = d3.axisBottom()
          .scale(localLegendScale1)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range1 / 2, 0, range1 / 2]);
        
        let localLegendAxis2 = d3.axisBottom()
          .scale(localLegendScale2)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range2 / 2, 0, range2 / 2]);
        
        svg$1.select(`g#local-legend-${i}-1`).select('g').call(localLegendAxis1);
        svg$1.select(`g#local-legend-${i}-2`).select('g').call(localLegendAxis2);
      }

      // Module legend
      for (let i = 0; i < 2; i++){
        let start = 1 + i * 5;
        let range = cnnLayerRanges.local[start];

        let moduleLegendScale = d3.scaleLinear()
          .range([0, 5 * nodeLength$2 + 3 * hSpaceAroundGap +
            1 * hSpaceAroundGap * gapRatio - 1.2])
          .domain([-range, range]);

        let moduleLegendAxis = d3.axisBottom()
          .scale(moduleLegendScale)
          .tickFormat(d3.format('.2f'))
          .tickValues([-range, -(range / 2), 0, range/2, range]);
        
        svg$1.select(`g#module-legend-${i}`).select('g').call(moduleLegendAxis);
      }

      // Global legend
      let start = 1;
      let range = cnnLayerRanges.global[start];

      let globalLegendScale = d3.scaleLinear()
        .range([0, 10 * nodeLength$2 + 6 * hSpaceAroundGap +
          3 * hSpaceAroundGap * gapRatio - 1.2])
        .domain([-range, range]);

      let globalLegendAxis = d3.axisBottom()
        .scale(globalLegendScale)
        .tickFormat(d3.format('.2f'))
        .tickValues([-range, -(range / 2), 0, range/2, range]);

      svg$1.select(`g#global-legend`).select('g').call(globalLegendAxis);

      // Output legend
      let outputLegendAxis = d3.axisBottom()
        .scale(outputRectScale)
        .tickFormat(d3.format('.1f'))
        .tickValues([0, cnnLayerRanges.output[1]]);
      
      svg$1.select('g#output-legend').select('g').call(outputLegendAxis);
    };

    /**
     * Update the ranges for current CNN layers
     */
    const updateCNNLayerRanges = () => {
      let cnnLayerRangesLocal = [];
      cnnLayerMinMax = [];

      for (let l = 0; l < cnn.length; l++) {
        let curLayer = cnn[l];
        let outputExtents = curLayer.map(node => getExtent(node.output));
        let aggregatedExtent = outputExtents.reduce((acc, cur) => {
          return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
        });

        cnnLayerMinMax.push({min: aggregatedExtent[0], max: aggregatedExtent[1]});
        let maxAbs = Math.max(Math.abs(aggregatedExtent[0]), Math.abs(aggregatedExtent[1]));
        let range = 2 * (0.1 + Math.round(maxAbs * 1000) / 1000);
        if (curLayer[0].type === 'input' || curLayer[0].type === 'sigmoid' ||
          curLayer[0].type === 'output') {
          range = 1;
        }
        cnnLayerRangesLocal.push(range);
      }

      let maxHiddenRange = Math.max(...cnnLayerRangesLocal.slice(1, cnnLayerRangesLocal.length - 1));
      let cnnLayerRangesGlobal = cnnLayerRangesLocal.map((range, i) => {
        if (i === 0 || i === cnnLayerRangesLocal.length - 1) return 1;
        return maxHiddenRange;
      });

      // Module scale follows local scale in AE mode.
      let cnnLayerRangesComponent = [...cnnLayerRangesLocal];

      cnnLayerRanges.local = cnnLayerRangesLocal;
      cnnLayerRanges.module = cnnLayerRangesComponent;
      cnnLayerRanges.global = cnnLayerRangesGlobal;
      cnnLayerRanges.output = [0, 1];

      cnnLayerRangesStore.set(cnnLayerRanges);
      cnnLayerMinMaxStore.set(cnnLayerMinMax);
    };

    /* global d3 */

    // Configs
    const layerColorScales$3 = overviewConfig.layerColorScales;
    const nodeLength$3 = overviewConfig.nodeLength;
    const intermediateColor = overviewConfig.intermediateColor;
    const svgPaddings$1 = overviewConfig.svgPaddings;
    const bottleneckValueBoxWidthRatio$2 = 1.45;
    const detailedHeadingToModelGap$1 = 35;
    const compactHeadingToModelGap$1 = 25;

    // Shared variables
    let svg$2 = undefined;
    svgStore.subscribe( value => {svg$2 = value;} );
    vSpaceAroundGapStore.subscribe( value => {} );

    let nodeCoordinate$1 = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate$1 = value;} );

    /**
     * Move one layer horizontally
     * @param {object} arg Multiple arguments {
     *   layerIndex: current layer index
     *   targetX: destination x
     *   disable: make this layer unresponsible
     *   delay: animation delay
     *   opacity: change the current layer's opacity
     *   specialIndex: avoid manipulating `specialIndex`th node
     *   onEndFunc: call this function when animation finishes
     *   transitionName: animation ID
     * }
     */
    const moveLayerX = (arg) => {
      let layerIndex = arg.layerIndex;
      let targetX = arg.targetX;
      let disable = arg.disable;
      let delay = arg.delay;
      let opacity = arg.opacity;
      let specialIndex = arg.specialIndex;
      let onEndFunc = arg.onEndFunc;
      let transitionName = arg.transitionName === undefined ? 'move' : arg.transitionName;
      let duration = arg.duration === undefined ? 500 : arg.duration;
      let modelTopY = d3.min((nodeCoordinate$1 || [])
        .filter(layer => layer && layer[0])
        .map(layer => layer[0].y));
      if (!Number.isFinite(modelTopY)) {
        modelTopY = svgPaddings$1.top;
      }

      // Move the selected layer
      let curLayer = svg$2.select(`g#cnn-layer-group-${layerIndex}`);
      curLayer.selectAll('g.node-group').each((d, i, g) => {
        d3.select(g[i])
          .style('cursor', disable && i !== specialIndex ? 'default' : 'pointer')
          .style('pointer-events', disable && i !== specialIndex ? 'none' : 'all')
          .select('image')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', targetX);
        
        d3.select(g[i])
          .select('rect.bounding')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', targetX);

        d3.select(g[i])
          .select('rect.map-border')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', targetX);

        d3.select(g[i])
          .select('rect.output-rect')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', d => {
            if (d.layerName === 'bottleneck') {
              return targetX + nodeLength$3 / 2 - (nodeLength$3 * bottleneckValueBoxWidthRatio$2) / 2;
            }
            return targetX + nodeLength$3 / 2;
          });

        d3.select(g[i])
          .select('text.output-text')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', d => d.layerName === 'bottleneck' ?
            targetX + nodeLength$3 / 2 : targetX);

        d3.select(g[i])
          .select('text.output-value')
          .transition(transitionName)
          .ease(d3.easeCubicInOut)
          .delay(delay)
          .duration(duration)
          .attr('x', targetX + nodeLength$3 / 2);
        
        if (opacity !== undefined && i !== specialIndex) {
          d3.select(g[i])
            .select('image')
            .style('opacity', opacity);

          d3.select(g[i])
            .select('rect.map-border')
            .style('opacity', opacity);

          d3.select(g[i])
            .select('rect.bounding')
            .style('opacity', opacity);
        }
      });
      
      // Also move the layer labels
      svg$2.selectAll(`g#layer-label-${layerIndex}`)
        .transition(transitionName)
        .ease(d3.easeCubicInOut)
        .delay(delay)
        .duration(duration)
        .attr('transform', () => {
          let x = targetX + nodeLength$3 / 2;
          let y = modelTopY - compactHeadingToModelGap$1;
          return `translate(${x}, ${y})`;
        })
        .on('end', onEndFunc);

      svg$2.selectAll(`g#layer-detailed-label-${layerIndex}`)
        .transition(transitionName)
        .ease(d3.easeCubicInOut)
        .delay(delay)
        .duration(duration)
        .attr('transform', () => {
          let x = targetX + nodeLength$3 / 2;
          let y = modelTopY - detailedHeadingToModelGap$1;
          return `translate(${x}, ${y})`;
        })
        .on('end', onEndFunc);
    };

    /**
     * Append a gradient definition to `group`
     * @param {string} gradientID CSS ID for the gradient def
     * @param {[{offset: number, color: string, opacity: number}]} stops Gradient stops
     * @param {element} group Element to append def to
     */
    const addOverlayGradient = (gradientID, stops, group) => {
      if (group === undefined) {
        group = svg$2;
      }

      // Create a gradient
      let defs = group.append("defs")
        .attr('class', 'overlay-gradient');

      let gradient = defs.append("linearGradient")
        .attr("id", gradientID)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "100%")
        .attr("y2", "100%");
      
      stops.forEach(s => {
        gradient.append('stop')
          .attr('offset', s.offset)
          .attr('stop-color', s.color)
          .attr('stop-opacity', s.opacity);
      });
    };

    /**
     * Draw the legend for intermediate layer
     * @param {object} arg 
     * {
     *   legendHeight: height of the legend rectangle
     *   curLayerIndex: the index of selected layer
     *   range: colormap range
     *   group: group to append the legend
     *   minMax: {min: min value, max: max value}
     *   width: width of the legend
     *   x: x position of the legend
     *   y: y position of the legend
     *   isInput: if the legend is for the input layer (special handle black to
     *      white color scale)
     *   colorScale: d3 color scale
     *   gradientAppendingName: name of the appending gradient
     *   gradientGap: gap to make the color lighter
     * }
     */
    const drawIntermediateLayerLegend = (arg) => {
      let legendHeight = arg.legendHeight,
        curLayerIndex = arg.curLayerIndex,
        range = arg.range,
        group = arg.group,
        minMax = arg.minMax,
        width = arg.width,
        x = arg.x,
        y = arg.y,
        isInput = arg.isInput,
        colorScale = arg.colorScale,
        gradientAppendingName = arg.gradientAppendingName,
        gradientGap = arg.gradientGap;
      
      if (colorScale === undefined) { colorScale = layerColorScales$3.conv; }
      if (gradientGap === undefined) { gradientGap = 0; }
      
      // Add a legend color gradient
      let gradientName = 'url(#inputGradient)';
      let normalizedColor = v => colorScale(v * (1 - 2 * gradientGap) + gradientGap);

      if (!isInput) {
        let leftValue = (minMax.min + range / 2) / range,
          zeroValue = (0 + range / 2) / range,
          rightValue = (minMax.max + range / 2) / range,
          totalRange = minMax.max - minMax.min,
          zeroLocation = (0 - minMax.min) / totalRange,
          leftMidValue = leftValue + (zeroValue - leftValue)/2,
          rightMidValue = zeroValue + (rightValue - zeroValue)/2;

        let stops = [
          {offset: 0, color: normalizedColor(leftValue), opacity: 1},
          {offset: zeroLocation / 2,
            color: normalizedColor(leftMidValue),
            opacity: 1},
          {offset: zeroLocation,
            color: normalizedColor(zeroValue),
            opacity: 1},
          {offset: zeroLocation + (1 - zeroValue) / 2,
            color: normalizedColor(rightMidValue),
            opacity: 1},
          {offset: 1, color: normalizedColor(rightValue), opacity: 1}
        ];

        if (gradientAppendingName === undefined) {
          addOverlayGradient('intermediate-legend-gradient', stops, group);
          gradientName = 'url(#intermediate-legend-gradient)';
        } else {
          addOverlayGradient(`${gradientAppendingName}`, stops, group);
          gradientName = `url(#${gradientAppendingName})`;
        }
      }

      let legendScale = d3.scaleLinear()
        .range([0, width - 1.2])
        .domain(isInput ? [0, range] : [minMax.min, minMax.max]);

      let legendAxis = d3.axisBottom()
        .scale(legendScale)
        .tickFormat(d3.format(isInput ? 'd' : '.2f'))
        .tickValues(isInput ? [0, range] : [minMax.min, 0, minMax.max]);
      
      let intermediateLegend = group.append('g')
        .attr('class', `intermediate-legend-${curLayerIndex - 1}`)
        .attr('transform', `translate(${x}, ${y})`);
      
      let legendGroup = intermediateLegend.append('g')
        .attr('transform', `translate(0, ${legendHeight - 3})`)
        .call(legendAxis);
      
      legendGroup.selectAll('text')
        .style('font-size', '9px')
        .style('fill', intermediateColor);
      
      legendGroup.selectAll('path, line')
        .style('stroke', intermediateColor);

      intermediateLegend.append('rect')
        .attr('width', width)
        .attr('height', legendHeight)
        .attr('transform', `rotate(${isInput ? 180 : 0},
      ${width / 2}, ${legendHeight / 2})`)
        .style('fill', gradientName);
    };

    /**
     * Draw an very neat arrow!
     * @param {object} arg 
     * {
     *   group: element to append this arrow to
     *   sx: source x
     *   sy: source y
     *   tx: target x
     *   ty: target y
     *   dr: radius of curve (I'm using a circle)
     *   hFlip: the direction to choose the circle (there are always two ways)
     * }
     */
    const drawArrow = (arg) => {
      let group = arg.group,
        sx = arg.sx,
        sy = arg.sy,
        tx = arg.tx,
        ty = arg.ty,
        dr = arg.dr,
        hFlip = arg.hFlip,
        marker = arg.marker === undefined ? 'marker' : arg.marker;

      /* Cool graphics trick -> merge translate and scale together
      translateX = (1 - scaleX) * tx,
      translateY = (1 - scaleY) * ty;
      */
      
      let arrow = group.append('g')
        .attr('class', 'arrow-group');

      arrow.append('path')
        .attr("d", `M${sx},${sy}A${dr},${dr} 0 0,${hFlip ? 0 : 1} ${tx},${ty}`)
        .attr('marker-end', `url(#${marker})`)
        .style('stroke', 'gray')
        .style('fill', 'none');
    };

    /* global d3 */

    // Configs
    const layerColorScales$4 = overviewConfig.layerColorScales;
    const nodeLength$4 = overviewConfig.nodeLength;
    const plusSymbolRadius = overviewConfig.plusSymbolRadius;
    const intermediateColor$1 = overviewConfig.intermediateColor;
    const kernelRectLength = overviewConfig.kernelRectLength;
    const svgPaddings$2 = overviewConfig.svgPaddings;
    const gapRatio$1 = overviewConfig.gapRatio;
    const fadedLayerOpacity = 0.15;
    const overlayRectOffset = overviewConfig.overlayRectOffset;
    const formater$1 = d3.format('.4f');
    let isEndOfAnimation = false;

    // Shared variables
    let svg$3 = undefined;
    svgStore.subscribe( value => {svg$3 = value;} );

    let vSpaceAroundGap$1 = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap$1 = value;} );

    let hSpaceAroundGap$1 = undefined;
    hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap$1 = value;} );

    let cnn$1 = undefined;
    cnnStore.subscribe( value => {cnn$1 = value;} );

    let nodeCoordinate$2 = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate$2 = value;} );

    let selectedScaleLevel$1 = undefined;
    selectedScaleLevelStore.subscribe( value => {selectedScaleLevel$1 = value;} );

    let cnnLayerRanges$1 = undefined;
    cnnLayerRangesStore.subscribe( value => {cnnLayerRanges$1 = value;} );

    let cnnLayerMinMax$1 = undefined;
    cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax$1 = value;} );

    let needRedraw = [undefined, undefined];
    needRedrawStore.subscribe( value => {needRedraw = value;} );

    let shouldIntermediateAnimate = undefined;
    shouldIntermediateAnimateStore.subscribe(value => {
      shouldIntermediateAnimate = value;
    });

    let detailedMode$1 = undefined;
    detailedModeStore.subscribe( value => {detailedMode$1 = value;} );

    let intermediateLayerPosition = undefined;
    intermediateLayerPositionStore.subscribe ( value => {intermediateLayerPosition = value;} );

    // let curRightX = 0;

    /**
     * Draw the intermediate layer activation heatmaps
     * @param {element} image Neuron heatmap image
     * @param {number} range Colormap range
     * @param {function} colorScale Colormap
     * @param {number} length Image length
     * @param {[[number]]} dataMatrix Heatmap matrix
     */
    const drawIntermidiateImage = (image, range, colorScale, length,
      dataMatrix) => {
      // Set up a buffer convas in order to resize image
      let imageLength = length;
      let bufferCanvas = document.createElement("canvas");
      let bufferContext = bufferCanvas.getContext("2d");
      bufferCanvas.width = imageLength;
      bufferCanvas.height = imageLength;

      // Fill image pixel array
      let imageSingle = bufferContext.getImageData(0, 0, imageLength, imageLength);
      let imageSingleArray = imageSingle.data;

      let safeRange = Math.abs(Number(range)) || 1;
      for (let i = 0; i < imageSingleArray.length; i+=4) {
        let pixeIndex = Math.floor(i / 4);
        let row = Math.floor(pixeIndex / imageLength);
        let column = pixeIndex % imageLength;
        let value = 0;
        if (dataMatrix && dataMatrix[row] && dataMatrix[row][column] !== undefined) {
          value = dataMatrix[row][column];
        }
        let normalized = (value + safeRange / 2) / safeRange;
        normalized = Math.max(0, Math.min(1, normalized));
        let color = d3.rgb(colorScale(normalized));

        imageSingleArray[i] = color.r;
        imageSingleArray[i + 1] = color.g;
        imageSingleArray[i + 2] = color.b;
        imageSingleArray[i + 3] = 255;
      }

      // canvas.toDataURL() only exports image in 96 DPI, so we can hack it to have
      // higher DPI by rescaling the image using canvas magic
      let largeCanvas = document.createElement('canvas');
      largeCanvas.width = nodeLength$4 * 3;
      largeCanvas.height = nodeLength$4 * 3;
      let largeCanvasContext = largeCanvas.getContext('2d');

      // Use drawImage to resize the original pixel array, and put the new image
      // (canvas) into corresponding canvas
      bufferContext.putImageData(imageSingle, 0, 0);
      largeCanvasContext.drawImage(bufferCanvas, 0, 0, imageLength, imageLength,
        0, 0, nodeLength$4 * 3, nodeLength$4 * 3);
      
      let imageDataURL = largeCanvas.toDataURL();
      image.attr('xlink:href', imageDataURL);

      // Destory the buffer canvas
      bufferCanvas.remove();
      largeCanvas.remove();
    };

    /**
     * Create a node group for the intermediate layer
     * @param {number} curLayerIndex Intermediate layer index
     * @param {number} selectedI Clicked node index
     * @param {element} groupLayer Group element
     * @param {number} x Node's x
     * @param {number} y Node's y
     * @param {number} nodeIndex Node's index
     * @param {function} intermediateNodeMouseOverHandler Mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler Mouse leave handler
     * @param {function} intermediateNodeClicked Mouse click handler
     * @param {bool} interaction Whether support interaction
     */
    const createIntermediateNode = (curLayerIndex, selectedI, groupLayer, x, y,
      nodeIndex, stride, intermediateNodeMouseOverHandler,
      intermediateNodeMouseLeaveHandler, intermediateNodeClicked, interaction) => {
      let newNode = groupLayer.append('g')
        .datum(cnn$1[curLayerIndex - 1][nodeIndex])
        .attr('class', 'intermediate-node')
        .attr('cursor', interaction ? 'pointer': 'default')
        .attr('pointer-events', interaction ? 'all': 'none')
        .attr('node-index', nodeIndex)
        .on('mouseover', intermediateNodeMouseOverHandler)
        .on('mouseleave', intermediateNodeMouseLeaveHandler)
        .on('click', (d, g, i) => intermediateNodeClicked(d, g, i, selectedI,
          curLayerIndex));
      
      newNode.append('image')
        .attr('width', nodeLength$4)
        .attr('height', nodeLength$4)
        .attr('x', x)
        .attr('y', y);

      // Overlay the image with a mask of many small rectangles
      let strideTime = Math.floor(nodeLength$4 / stride);
      let overlayGroup = newNode.append('g')
        .attr('class', 'overlay-group')
        .attr('transform', `translate(${x}, ${y})`);
      
      for (let i = 0; i < strideTime; i++) {
        for (let j = 0; j < strideTime; j++) {
          overlayGroup.append('rect')
            .attr('class', `mask-overlay mask-${i}-${j}`)
            .attr('width', stride)
            .attr('height', stride)
            .attr('x', i * stride)
            .attr('y', j * stride)
            .style('fill', 'var(--light-gray)')
            .style('stroke', 'var(--light-gray)')
            .style('opacity', 1);
        }
      }

      // Add a rectangle to show the border
      newNode.append('rect')
        .attr('class', 'bounding')
        .attr('width', nodeLength$4)
        .attr('height', nodeLength$4)
        .attr('x', x)
        .attr('y', y)
        .style('fill', 'none')
        .style('stroke', intermediateColor$1)
        .style('stroke-width', 1);
      
      return newNode;
    };

    const startOutputAnimation = (kernelGroup, tickTime1D, stride, delay,
      curLayerIndex) => {
      const slidingAnimation = () => {
        let originX = +kernelGroup.attr('data-origin-x');
        let originY = +kernelGroup.attr('data-origin-y');
        let oldTick = +kernelGroup.attr('data-tick');
        let i = Math.floor((oldTick) % tickTime1D);
        let j = Math.floor((oldTick) / tickTime1D);
        let x = originX + i * stride;
        let y = originY + j * stride;
        let newTick = (oldTick + 1) % (tickTime1D * tickTime1D);

        // Remove one mask rect at each tick
        svg$3.selectAll(`rect.mask-${i}-${j}`)
          .transition('window-sliding-mask')
          .delay(delay + 100)
          .duration(300)
          .style('opacity', 0);

          kernelGroup.attr('data-tick', newTick)
          .transition('window-sliding-input')
          .delay(delay)
          .duration(200)
          .attr('transform', `translate(${x}, ${y})`)
          .on('end', () => {
            if (newTick === 0) {
              /* Uncomment to wrap the sliding
              svg.selectAll(`rect.mask-overlay`)
                .transition('window-sliding-mask')
                .delay(delay - 200)
                .duration(300)
                .style('opacity', 1);
              */

              // Stop the animation
              // Be careful with animation racing so call this function here instead
              // of under selectALL
              if (!isEndOfAnimation) {
                animationButtonClicked(curLayerIndex);
              }
            }
            if (shouldIntermediateAnimate) {
              slidingAnimation();
            }
          });
      };
      slidingAnimation();
    };

    const startIntermediateAnimation = (kernelGroupInput, kernelGroupResult,
      tickTime1D, stride) => {
      let delay = 200;
      const slidingAnimation = () => {
        let originX = +kernelGroupInput.attr('data-origin-x');
        let originY = +kernelGroupInput.attr('data-origin-y');
        let originXResult = +kernelGroupResult.attr('data-origin-x');
        let oldTick = +kernelGroupInput.attr('data-tick');
        let i = Math.floor((oldTick) % tickTime1D);
        let j = Math.floor((oldTick) / tickTime1D);
        let x = originX + i * stride;
        let y = originY + j * stride;
        let xResult = originXResult + (oldTick % tickTime1D) * stride;
        let newTick = (oldTick + 1) % (tickTime1D * tickTime1D);

        // Remove one mask rect at each tick
        svg$3.selectAll(`rect.mask-${i}-${j}`)
          .transition('window-sliding-mask')
          .delay(delay + 100)
          .duration(300)
          .style('opacity', 0);

        kernelGroupInput.attr('data-tick', newTick)
          .transition('window-sliding-input')
          .delay(delay)
          .duration(200)
          .attr('transform', `translate(${x}, ${y})`);

        kernelGroupResult.attr('data-tick', newTick)
          .transition('window-sliding-result')
          .delay(delay)
          .duration(200)
          .attr('transform', `translate(${xResult}, ${y})`)
          .on('end', () => {
            /* Uncomment to wrap the sliding
            if (newTick === 0) {
              svg.selectAll(`rect.mask-overlay`)
                .transition('window-sliding-mask')
                .delay(delay - 200)
                .duration(300)
                .style('opacity', 1);
            }
            */
            if (shouldIntermediateAnimate) {
              slidingAnimation();
            }
          });
      };
      slidingAnimation();
    };

    const animationButtonClicked = (curLayerIndex) => {
      if (d3.event !== null) {
        d3.event.stopPropagation();
      }
      
      let delay = 200;
      let tickTime1D = Math.max(1, Math.floor(nodeLength$4 / (kernelRectLength * 3)));
      let stride = kernelRectLength * 3; 

      if (isEndOfAnimation) {
        // Start the animation
        shouldIntermediateAnimateStore.set(true);

        // Show kernel
        svg$3.selectAll('.kernel-clone')
          .transition()
          .duration(300)
          .style('opacity', 1);

        // Restore the mask
        svg$3.selectAll(`rect.mask-overlay`)
          .transition()
          .duration(300)
          .style('opacity', 1);

        // Start the intermediate animation
        for (let i  = 0; i < nodeCoordinate$2[curLayerIndex - 1].length; i++) {
          startIntermediateAnimation(d3.select(`.kernel-input-${i}`),
            d3.select(`.kernel-result-${i}`), tickTime1D, stride);
        }

        // Start the output animation
        startOutputAnimation(d3.select('.kernel-output'),
          tickTime1D, stride, delay, curLayerIndex);
        
        // Change the flow edge style
        svg$3.selectAll('path.flow-edge')
          .attr('stroke-dasharray', '4 2')
          .attr('stroke-dashoffset', 0)
          .each((d, i, g) => animateEdge(d, i, g, 0 - 1000));

        // Change button icon
        svg$3.select('.animation-control-button')
          .attr('xlink:href', '/assets/img/fast_forward.svg');
        
        isEndOfAnimation = false;

      } else {
        // End the animation
        shouldIntermediateAnimateStore.set(false);
        
        // Show all intermediate and output results
        svg$3.selectAll(`rect.mask-overlay`)
          .transition('skip')
          .duration(600)
          .style('opacity', 0);
        
        // Move kernel to the beginning to prepare for the next animation
        let kernelClones = svg$3.selectAll('.kernel-clone');
        kernelClones.attr('data-tick', 0)
          .transition('skip')
          .duration(300)
          .style('opacity', 0)
          .on('end', (d, i, g) => {
            let element = d3.select(g[i]);
            let originX = +element.attr('data-origin-x');
            let originY = +element.attr('data-origin-y');
            element.attr('transform', `translate(${originX}, ${originY})`);
          });
        
        // Change flow edge style
        svg$3.selectAll('path.flow-edge')
          .interrupt()
          .attr('stroke-dasharray', '0 0');
        
        // Change button icon
        svg$3.select('.animation-control-button')
          .attr('xlink:href', '/assets/img/redo.svg');
        
        isEndOfAnimation = true;
      }
    };

    const animateEdge = (d, i, g, dashoffset) => {
      let curPath = d3.select(g[i]);
      curPath.transition()
        .duration(60000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', dashoffset)
        .on('end', (d, i, g) => {
          if (shouldIntermediateAnimate) {
            animateEdge(d, i, g, dashoffset - 2000);
          }
        });
    };

    /**
     * Draw one intermediate layer
     * @param {number} curLayerIndex 
     * @param {number} leftX X value of intermediate layer left border
     * @param {number} rightX X value of intermediate layer right border
     * @param {number} rightStart X value of right component starting anchor
     * @param {number} intermediateGap The inner gap
     * @param {number} d Clicked node bounded data
     * @param {number} i Clicked node index
     * @param {function} intermediateNodeMouseOverHandler Mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler Mouse leave handler
     * @param {function} intermediateNodeClicked Mouse click handler
     */
    const drawIntermediateLayer = (curLayerIndex, leftX, rightX, rightStart,
      intermediateGap, d, i, intermediateNodeMouseOverHandler,
      intermediateNodeMouseLeaveHandler, intermediateNodeClicked) => {
      
      // curRightX = rightStart;

      // Add the intermediate layer
      let intermediateLayer = svg$3.append('g')
        .attr('class', 'intermediate-layer')
        .style('opacity', 0);
      
      // Recovert the animation counter
      isEndOfAnimation = false;
      
      // Tried to add a rectangle to block the intermediate because of webkit's
      // horrible support (decade old bug) for foreignObject. It doesnt work either.
      // https://bugs.webkit.org/show_bug.cgi?id=23113
      // (1). ForeignObject's inside position is wrong on webkit
      // (2). 'opacity' of ForeignObject doesn't work on webkit
      // (3). ForeignObject always show up at the front regardless the svg
      //      stacking order on webkit

      let intermediateX1 = leftX + nodeLength$4 + intermediateGap;
      let intermediateX2 = intermediateX1 + nodeLength$4 + intermediateGap * 1.5;

      let range = cnnLayerRanges$1[selectedScaleLevel$1][curLayerIndex];
      let colorScale = layerColorScales$4[d.type];
      let intermediateMinMax = [];
      
      // Copy the previsious layer to construct foreignObject placeholder
      // Also add edges from/to the intermediate layer in this loop
      let linkData = [];

      // Accumulate the intermediate sum
      // let itnermediateSumMatrix = init2DArray(d.output.length,
      //  d.output.length, 0);

      // Compute the min max of all kernel weights in the intermediate layer
      let kernelExtents = d.inputLinks.map(link => getExtent(link.weight));
      let kernelExtent = kernelExtents.reduce((acc, cur) => {
        return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
      });
      let kernelRange = 2 * (Math.round(
        Math.max(...kernelExtent.map(Math.abs)) * 1000) / 1000);
      let kernelColorGap = 0.2;

      // Compute stride for the kernel animation
      let stride = kernelRectLength * 3; 

      // Also add the overlay mask on the output node
      let outputY = nodeCoordinate$2[curLayerIndex][i].y;
      let curNode = svg$3.select(`#layer-${curLayerIndex}-node-${i}`);
      let outputOverlayGroup = curNode.append('g')
        .attr('class', 'overlay-group')
        .attr('transform', `translate(${rightX}, ${outputY})`);

      let strideTime = Math.floor(nodeLength$4 / stride);
      
      for (let i = 0; i < strideTime; i++) {
        for (let j = 0; j < strideTime; j++) {
          outputOverlayGroup.append('rect')
            .attr('class', `mask-overlay mask-${i}-${j}`)
            .attr('width', stride)
            .attr('height', stride)
            .attr('x', i * stride)
            .attr('y', j * stride)
            .style('fill', 'var(--light-gray)')
            .style('stroke', 'var(--light-gray)')
            .style('opacity', 1);
        }
      }

      // Make sure the bounding box is on top of other things
      curNode.select('rect.bounding').raise();

      // Add sliding kernel for the output node
      let kernelGroup = intermediateLayer.append('g')
        .attr('class', `kernel kernel-output kernel-clone`)
        .attr('transform', `translate(${rightX}, ${outputY})`);

      kernelGroup.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', kernelRectLength * 3)
        .attr('height', kernelRectLength * 3)
        .attr('fill', 'none')
        .attr('stroke', intermediateColor$1);
      
      kernelGroup.attr('data-tick', 0)
        .attr('data-origin-x', rightX)
        .attr('data-origin-y', outputY);

      let delay = 200;
      let tickTime1D = Math.max(1, Math.floor(nodeLength$4 / (kernelRectLength * 3)));

      startOutputAnimation(kernelGroup, tickTime1D, stride, delay, curLayerIndex);

      // First intermediate layer
      nodeCoordinate$2[curLayerIndex - 1].forEach((n, ni) => {

        // Compute the intermediate value
        let inputMatrix = cnn$1[curLayerIndex - 1][ni].output;
        let kernelMatrix = cnn$1[curLayerIndex][i].inputLinks[ni].weight;
        let interMatrix = singleConv(inputMatrix, kernelMatrix);

        // Compute the intermediate layer min max
        intermediateMinMax.push(getExtent(interMatrix));

        // Update the intermediate sum
        // itnermediateSumMatrix = matrixAdd(itnermediateSumMatrix, interMatrix);

        // Layout the canvas and rect
        let newNode = createIntermediateNode(curLayerIndex, i, intermediateLayer,
          intermediateX1, n.y, ni, stride, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked, true);
        
        // Draw the image
        let image = newNode.select('image');
        drawIntermidiateImage(image, range, colorScale, interMatrix.length,
          interMatrix);      

        // Edge: input -> intermediate1
        linkData.push({
          source: getOutputKnot({x: leftX, y: n.y}),
          target: getInputKnot({x: intermediateX1, y: n.y}),
          name: `input-${ni}-inter1-${ni}`
        });

        // Edge: intermediate1 -> intermediate2-1
        linkData.push({
          source: getOutputKnot({x: intermediateX1, y: n.y}),
          target: getInputKnot({x: intermediateX2,
            y: nodeCoordinate$2[curLayerIndex][i].y}),
          name: `inter1-${ni}-inter2-1`
        });

        // Create a small kernel illustration
        // Here we minus 2 because of no padding
        // let tickTime1D = nodeLength / (kernelRectLength) - 2;
        let kernelRectX = leftX - kernelRectLength * 3 * 2;
        let kernelGroup = intermediateLayer.append('g')
          .attr('class', `kernel kernel-${ni}`)
          .attr('transform', `translate(${kernelRectX}, ${n.y})`);

        let weightText = 'Kernel weights: [';
        let f2 = d3.format('.2f');
        for (let r = 0; r < kernelMatrix.length; r++) {
          for (let c = 0; c < kernelMatrix[0].length; c++) {
            kernelGroup.append('rect')
              .attr('class', 'kernel')
              .attr('x', kernelRectLength * c)
              .attr('y', kernelRectLength * r)
              .attr('width', kernelRectLength)
              .attr('height', kernelRectLength)
              .attr('fill', gappedColorScale(layerColorScales$4.weight, kernelRange,
                kernelMatrix[r][c], kernelColorGap));

            let sep = '';
            if (c === 0 && r == 0) { sep = ''; }
            else if (c === 0) { sep = '; '; }
            else { sep = ', '; }
            weightText = weightText.concat(sep, `${f2(kernelMatrix[r][c])}`);
          }
        }
        weightText = weightText.concat(']');

        kernelGroup.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', kernelRectLength * 3)
          .attr('height', kernelRectLength * 3)
          .attr('fill', 'none')
          .attr('stroke', intermediateColor$1);
        
        kernelGroup.style('pointer-events', 'all')
          .style('cursor', 'crosshair')
          .on('mouseover', () => {
            hoverInfoStore.set( {show: true, text: weightText} );
          })
          .on('mouseleave', () => {
            hoverInfoStore.set( {show: false, text: weightText} );
          })
          .on('click', () => {d3.event.stopPropagation();});

        // Sliding the kernel on the input channel and result channel at the same
        // time
        let kernelGroupInput = kernelGroup.clone(true)
          .style('pointer-events', 'none')
          .style('cursor', 'pointer')
          .classed('kernel-clone', true)
          .classed(`kernel-input-${ni}`, true);

        kernelGroupInput.style('opacity', 0.9)
          .selectAll('rect.kernel')
          .style('opacity', 0.7);

        kernelGroupInput.attr('transform', `translate(${leftX}, ${n.y})`)
          .attr('data-tick', 0)
          .attr('data-origin-x', leftX)
          .attr('data-origin-y', n.y);

        let kernelGroupResult = kernelGroup.clone(true)
          .style('pointer-events', 'none')
          .style('cursor', 'pointer')
          .classed('kernel-clone', true)
          .classed(`kernel-result-${ni}`, true);

        kernelGroupResult.style('opacity', 0.9)
          .selectAll('rect.kernel')
          .style('fill', 'none');

        kernelGroupResult.attr('transform',
          `translate(${intermediateX1}, ${n.y})`)
          .attr('data-origin-x', intermediateX1)
          .attr('data-origin-y', n.y);
        
        startIntermediateAnimation(kernelGroupInput, kernelGroupResult, tickTime1D,
          stride);
      });

      // Aggregate the intermediate min max
      let aggregatedExtent = intermediateMinMax.reduce((acc, cur) => {
        return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1])];
      });
      let aggregatedMinMax = {min: aggregatedExtent[0], max: aggregatedExtent[1]};

      // Draw the plus operation symbol
      let symbolY = nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 / 2;
      let symbolRectHeight = 1;
      let symbolGroup = intermediateLayer.append('g')
        .attr('class', 'plus-symbol')
        .attr('transform', `translate(${intermediateX2 + plusSymbolRadius}, ${symbolY})`);
      
      symbolGroup.append('rect')
        .attr('x', -plusSymbolRadius)
        .attr('y', -plusSymbolRadius)
        .attr('width', 2 * plusSymbolRadius)
        .attr('height', 2 * plusSymbolRadius)
        .attr('rx', 3)
        .attr('ry', 3)
        .style('fill', 'none')
        .style('stroke', intermediateColor$1);
      
      symbolGroup.append('rect')
        .attr('x', -(plusSymbolRadius - 3))
        .attr('y', -symbolRectHeight / 2)
        .attr('width', 2 * (plusSymbolRadius - 3))
        .attr('height', symbolRectHeight)
        .style('fill', intermediateColor$1);

      symbolGroup.append('rect')
        .attr('x', -symbolRectHeight / 2)
        .attr('y', -(plusSymbolRadius - 3))
        .attr('width', symbolRectHeight)
        .attr('height', 2 * (plusSymbolRadius - 3))
        .style('fill', intermediateColor$1);

      // Place the bias rectangle below the plus sign if user clicks the firrst
      // conv node
      if (i == 0) {
        // Add bias symbol to the plus symbol
        symbolGroup.append('circle')
            .attr('cx', 0)
            .attr('cy', nodeLength$4 / 2 + kernelRectLength)
            .attr('r', 4)
            .style('stroke', intermediateColor$1)
            .style('cursor', 'crosshair')
            .style('fill', gappedColorScale(layerColorScales$4.weight, kernelRange,
              d.bias, kernelColorGap))
            .on('mouseover', () => {
              hoverInfoStore.set( {show: true, text: `Bias: ${formater$1(d.bias)}`} );
            })
            .on('mouseleave', () => {
              hoverInfoStore.set( {show: false, text: `Bias: ${formater$1(d.bias)}`} );
            });

        // Link from bias to the plus symbol
        linkData.push({
          source: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4},
          target: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 / 2 + plusSymbolRadius},
          name: `bias-plus`
        });
      } else {
        // Add bias symbol to the plus symbol
        symbolGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', -nodeLength$4 / 2 - kernelRectLength)
          .attr('r', 4)
          .style('stroke', intermediateColor$1)
          .style('cursor', 'crosshair')
          .style('fill', gappedColorScale(layerColorScales$4.weight, kernelRange,
            d.bias, kernelColorGap))
          .on('mouseover', () => {
            hoverInfoStore.set( {show: true, text: `Bias: ${formater$1(d.bias)}`} );
          })
          .on('mouseleave', () => {
            hoverInfoStore.set( {show: false, text: `Bias: ${formater$1(d.bias)}`} );
          });
        
        // Link from bias to the plus symbol
        linkData.push({
          source: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$2[curLayerIndex][i].y},
          target: {x: intermediateX2 + plusSymbolRadius,
            y: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 / 2 - plusSymbolRadius},
          name: `bias-plus`
        });
      }

      // Link from the plus symbol to the output
      linkData.push({
        source: getOutputKnot({x: intermediateX2 + 2 * plusSymbolRadius - nodeLength$4,
          y: nodeCoordinate$2[curLayerIndex][i].y}),
        target: getInputKnot({x: rightX,
          y: nodeCoordinate$2[curLayerIndex][i].y}),
        name: `symbol-output`
      });
      
      // Output -> next layer
      linkData.push({
        source: getOutputKnot({x: rightX,
          y: nodeCoordinate$2[curLayerIndex][i].y}),
        target: getInputKnot({x: rightStart,
          y: nodeCoordinate$2[curLayerIndex][i].y}),
        name: `output-next`
      });

      // Draw the layer label
      intermediateLayer.append('g')
        .attr('class', 'layer-intermediate-label layer-label')
        .attr('transform', () => {
          let x = intermediateX1 + nodeLength$4 / 2;
          let y = Math.max(12, svgPaddings$2.top - 22);
          return `translate(${x}, ${y})`;
        })
        .classed('hidden', detailedMode$1)
        .append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('font-weight', 800)
        .style('opacity', '0.8')
        .text('intermediate');
      
      intermediateLayer.append('g')
        .attr('class', 'animation-control')
        .attr('transform', () => {
          let x = intermediateX1 + nodeLength$4 / 2;
          let y = Math.max(8, svgPaddings$2.top - 31);
          return `translate(${x}, ${y})`;
        })
        .on('click', () => animationButtonClicked(curLayerIndex))
        .append('image')
        .attr('class', 'animation-control-button')
        .attr('xlink:href', '/assets/img/fast_forward.svg')
        .attr('x', 50)
        .attr('y', 0)
        .attr('height', 13)
        .attr('width', 13);

      // Draw the detailed model layer label
      intermediateLayer.append('g')
        .attr('class', 'layer-intermediate-label layer-detailed-label')
        .attr('transform', () => {
          let x = intermediateX1 + nodeLength$4 / 2;
          let y = Math.max(8, svgPaddings$2.top - 30);
          return `translate(${x}, ${y})`;
        })
        .classed('hidden', !detailedMode$1)
        .append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('opacity', '0.7')
        .style('font-weight', 800)
        .append('tspan')
        .text('intermediate')
        .append('tspan')
        .style('font-size', '8px')
        .style('font-weight', 'normal')
        .attr('x', 0)
        .attr('dy', '1.5em')
        .text(`(${cnn$1[curLayerIndex][0].output.length},
      ${cnn$1[curLayerIndex][0].output[0].length},
      ${cnn$1[curLayerIndex].length})`);

      // Draw the edges
      let linkGen = d3.linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);
      
      let edgeGroup = intermediateLayer.append('g')
        .attr('class', 'edge-group')
        .lower();
      
      let dashoffset = 0;

      edgeGroup.selectAll('path')
        .data(linkData)
        .enter()
        .append('path')
        .classed('flow-edge', d => d.name !== 'output-next')
        .attr('id', d => `edge-${d.name}`)
        .attr('d', d => linkGen({source: d.source, target: d.target}))
        .style('fill', 'none')
        .style('stroke-width', 1)
        .style('stroke', intermediateColor$1);

      edgeGroup.select('#edge-output-next')
        .style('opacity', 0.1);
      
      edgeGroup.selectAll('path.flow-edge')
        .attr('stroke-dasharray', '4 2')
        .attr('stroke-dashoffset', 0)
        .each((d, i, g) => animateEdge(d, i, g, dashoffset - 1000));
      
      return {intermediateLayer: intermediateLayer,
        intermediateMinMax: aggregatedMinMax,
        kernelRange: kernelRange,
        kernelMinMax: {min: kernelExtent[0], max: kernelExtent[1]}};
    };

    /**
     * Add an annotation for the kernel and the sliding
     * @param {object} arg 
     * {
     *  leftX: X value of the left border of intermedaite layer
     *  group: element group
     *  intermediateGap: the inner gap of intermediate layer
     *  isFirstConv: if this intermediate layer is after the first layer
     *  i: index of the selected node
     * }
     */
    const drawIntermediateLayerAnnotation = (arg) => {
      let leftX = arg.leftX,
        curLayerIndex = arg.curLayerIndex,
        group = arg.group,
        intermediateGap = arg.intermediateGap,
        isFirstConv = arg.isFirstConv,
        i = arg.i;

      let kernelAnnotation = group.append('g')
        .attr('class', 'kernel-annotation');
      
      kernelAnnotation.append('text')
        .text('Kernel')
        .attr('class', 'annotation-text')
        .attr('x', leftX - 2.5 * kernelRectLength * 3)
        .attr('y', nodeCoordinate$2[curLayerIndex - 1][0].y + kernelRectLength * 3)
        .style('dominant-baseline', 'baseline')
        .style('text-anchor', 'end');

      let sliderX, sliderY, arrowSX, arrowSY, dr;
      let sliderX2, sliderY2, arrowSX2, arrowSY2, dr2, arrowTX2, arrowTY2;
      
      if (isFirstConv) {
        sliderX = leftX;
        sliderY = nodeCoordinate$2[curLayerIndex - 1][0].y + nodeLength$4 +
          kernelRectLength * 3;
        arrowSX = leftX - 5;
        arrowSY = nodeCoordinate$2[curLayerIndex - 1][0].y + nodeLength$4 +
          kernelRectLength * 3 + 5;
        dr = 20;

        sliderX2 = leftX;
          sliderY2 = nodeCoordinate$2[curLayerIndex - 1][1].y + nodeLength$4 +
        kernelRectLength * 3;
        arrowSX2 = leftX - kernelRectLength * 3;
        arrowSY2 = nodeCoordinate$2[curLayerIndex - 1][1].y + nodeLength$4 + 15;
        arrowTX2 = leftX - 13;
        arrowTY2 =  nodeCoordinate$2[curLayerIndex - 1][1].y + 15;
        dr2 = 35;
      } else {
        sliderX = leftX - 3 * kernelRectLength * 3;
        sliderY = nodeCoordinate$2[curLayerIndex - 1][0].y + nodeLength$4 / 3;
        arrowSX = leftX - 2 * kernelRectLength * 3 - 5;
        arrowSY = nodeCoordinate$2[curLayerIndex - 1][0].y + nodeLength$4 - 10;
        dr = 50;

        sliderX2 = leftX - 3 * kernelRectLength * 3;
        sliderY2 = nodeCoordinate$2[curLayerIndex - 1][2].y - 3;
        arrowTX2 = leftX - kernelRectLength * 3 - 4;
        arrowTY2 = nodeCoordinate$2[curLayerIndex - 1][2].y + kernelRectLength * 3 + 6;
        arrowSX2 = leftX - kernelRectLength * 3 - 13;
        arrowSY2 = nodeCoordinate$2[curLayerIndex - 1][2].y + 26;
        dr2 = 20;
      }

      let slideText = kernelAnnotation.append('text')
        .attr('x', sliderX)
        .attr('y', sliderY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', isFirstConv ? 'start' : 'end');
      
      slideText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Slide kernel over input channel');

      slideText.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('to get intermediate result');

      // slideText.append('tspan')
      //   .attr('x', sliderX)
      //   .attr('dy', '1em')
      //   .style('dominant-baseline', 'hanging')
      //   .text('');

      slideText.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1.2em')
        .style('dominant-baseline', 'hanging')
        .style('font-weight', 700)
        .text('Click ');
      
      slideText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .style('font-weight', 400)
        .text('to learn more');

      drawArrow({
        group: group,
        tx: leftX - 7,
        ty: nodeCoordinate$2[curLayerIndex - 1][0].y + nodeLength$4 / 2,
        sx: arrowSX,
        sy: arrowSY,
        hFlip: !isFirstConv,
        dr: dr,
        marker: 'marker'
      });

      // Add kernel annotation
      let slideText2 = kernelAnnotation.append('text')
        .attr('x', sliderX2)
        .attr('y', sliderY2)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', isFirstConv ? 'start' : 'end');

      slideText2.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Each input chanel');

      slideText2.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('gets a different kernel');

      slideText2.append('tspan')
        .attr('x', sliderX)
        .attr('dy', '1.3em')
        .style('font-weight', 700)
        .style('dominant-baseline', 'hanging')
        .text('Hover over ');

      slideText2.append('tspan')
        .style('font-weight', 400)
        .style('dominant-baseline', 'hanging')
        .text('to see value!');

      drawArrow({
        group: group,
        tx: arrowTX2,
        ty: arrowTY2,
        sx: arrowSX2,
        sy: arrowSY2,
        dr: dr2,
        hFlip: !isFirstConv,
        marker: 'marker'
      });


      // Add annotation for the sum operation
      let plusAnnotation = group.append('g')
        .attr('class', 'plus-annotation');
      
      let intermediateX2 = leftX + 2 * nodeLength$4 + 2.5 * intermediateGap;
      let textX = intermediateX2;
      let textY = nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 +
          kernelRectLength * 3;
      
      // Special case 1: first node
      if (i === 0) { textX += 30; }

      // Special case 2: last node 
      if (i === 9) {
        textX = intermediateX2 + plusSymbolRadius - 10;
        textY -= 2.5 * nodeLength$4;
      }

      let plusText = plusAnnotation.append('text')
        .attr('x', textX)
        .attr('y', textY)
        .attr('class', 'annotation-text')
        .style('dominant-baseline', 'hanging')
        .style('text-anchor', 'start');
      
      plusText.append('tspan')
        .style('dominant-baseline', 'hanging')
        .text('Add up all intermediate');
      
      plusText.append('tspan')
        .attr('x', textX)
        .attr('dy', '1em')
        .style('dominant-baseline', 'hanging')
        .text('results and then add bias');
      
      if (i === 9) {
        drawArrow({
          group: group,
          sx: intermediateX2 + 50,
          sy: nodeCoordinate$2[curLayerIndex][i].y - (nodeLength$4 / 2 + kernelRectLength * 2),
          tx: intermediateX2 + 2 * plusSymbolRadius + 5,
          ty: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 / 2 - plusSymbolRadius,
          dr: 50,
          hFlip: false,
          marker: 'marker-alt'
        });
      } else {
        drawArrow({
          group: group,
          sx: intermediateX2 + 35,
          sy: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 + kernelRectLength * 2,
          tx: intermediateX2 + 2 * plusSymbolRadius + 5,
          ty: nodeCoordinate$2[curLayerIndex][i].y + nodeLength$4 / 2 + plusSymbolRadius,
          dr: 30,
          hFlip: true,
          marker: 'marker-alt'
        });
      }

      // Add annotation for the bias
      let biasTextY = nodeCoordinate$2[curLayerIndex][i].y;
      if (i === 0) {
        biasTextY += nodeLength$4 + 3 * kernelRectLength;
      } else {
        biasTextY -= 2 * kernelRectLength + 5;
      }
      plusAnnotation.append('text')
        .attr('class', 'annotation-text')
        .attr('x', intermediateX2 + plusSymbolRadius)
        .attr('y', biasTextY)
        .style('text-anchor', 'middle')
        .style('dominant-baseline', i === 0 ? 'hanging' : 'baseline')
        .text('Bias');
    };

    /**
     * Append a filled rectangle under a pair of nodes.
     * @param {number} curLayerIndex Index of the selected layer
     * @param {number} i Index of the selected node
     * @param {number} leftX X value of the left border of intermediate layer
     * @param {number} intermediateGap Inner gap of this intermediate layer
     * @param {number} padding Padding around the rect
     * @param {function} intermediateNodeMouseOverHandler Mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler Mouse leave handler
     * @param {function} intermediateNodeClicked Mouse click handler
     */
    const addUnderneathRect = (curLayerIndex, i, leftX,
      intermediateGap, padding, intermediateNodeMouseOverHandler,
      intermediateNodeMouseLeaveHandler, intermediateNodeClicked) => {
      // Add underneath rects
      let underGroup = svg$3.select('g.underneath');

      for (let n = 0; n < cnn$1[curLayerIndex - 1].length; n++) {
        underGroup.append('rect')
          .attr('class', 'underneath-gateway')
          .attr('id', `underneath-gateway-${n}`)
          .attr('x', leftX - padding)
          .attr('y', nodeCoordinate$2[curLayerIndex - 1][n].y - padding)
          .attr('width', (2 * nodeLength$4 + intermediateGap) + 2 * padding)
          .attr('height', nodeLength$4 + 2 * padding)
          .attr('rx', 10)
          .style('fill', 'rgba(160, 160, 160, 0.2)')
          .style('opacity', 0);
        
        // Register new events for input layer nodes
        svg$3.select(`g#layer-${curLayerIndex - 1}-node-${n}`)
          .style('pointer-events', 'all')
          .style('cursor', 'pointer')
          .on('mouseover', intermediateNodeMouseOverHandler)
          .on('mouseleave', intermediateNodeMouseLeaveHandler)
          .on('click', (d, ni, g) => intermediateNodeClicked(d, ni, g,
            i, curLayerIndex));
          // .on('click', (d, i) => {console.log(i)});
      }
      underGroup.lower();
    };

    /**
     * Add an overlaying rect
     * @param {string} gradientName Gradient name of overlay rect
     * @param {number} x X value of the overlaying rect
     * @param {number} y Y value of the overlaying rect
     * @param {number} width Rect width
     * @param {number} height Rect height
     */
    const addOverlayRect = (gradientName, x, y, width, height) => {
      let safeWidth = Math.max(0, Number(width) || 0);
      let safeHeight = Math.max(0, Number(height) || 0);

      if (svg$3.select('.intermediate-layer-overlay').empty()) {
        svg$3.append('g').attr('class', 'intermediate-layer-overlay');
      }

      let intermediateLayerOverlay = svg$3.select('.intermediate-layer-overlay');

      let overlayRect = intermediateLayerOverlay.append('rect')
        .attr('class', 'overlay')
        .style('fill', `url(#${gradientName})`)
        .style('stroke', 'none')
        .attr('width', safeWidth)
        .attr('height', safeHeight)
        .attr('x', x)
        .attr('y', y)
        .style('opacity', 0);
      
      overlayRect.transition('move')
        .duration(800)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Redraw the layer if needed (entering the intermediate view to make sure
     * all layers have the same color scale)
     * @param {number} curLayerIndex Index of the selected layer
     * @param {number} i Index of the selected node
     */
    const redrawLayerIfNeeded = (curLayerIndex, i) => {
      // Determine the range for this layerview, and redraw the layer with
      // smaller range so all layers have the same range
      let rangePre = cnnLayerRanges$1[selectedScaleLevel$1][curLayerIndex - 1];
      let rangeCur = cnnLayerRanges$1[selectedScaleLevel$1][curLayerIndex];
      let range = Math.max(rangePre, rangeCur);

      if (rangePre > rangeCur) {
        // Redraw the current layer (selected node)
        svg$3.select(`g#layer-${curLayerIndex}-node-${i}`)
          .select('image.node-image')
          .each((d, g, i) => drawOutput(d, g, i, range));
        
        // Record the change so we will re-redraw the layer when user quits
        // the intermediate view
        needRedraw = [curLayerIndex, i];
        needRedrawStore.set(needRedraw);
        
      } else if (rangePre < rangeCur) {
        // Redraw the previous layer (whole layer)
        svg$3.select(`g#cnn-layer-group-${curLayerIndex - 1}`)
          .selectAll('image.node-image')
          .each((d, g, i) => drawOutput(d, g, i, range));

        // Record the change so we will re-redraw the layer when user quits
        // the intermediate view
        needRedraw = [curLayerIndex - 1, undefined];
        needRedrawStore.set(needRedraw);
      }

      // Compute the min, max value of all nodes in pre-layer and the selected
      // node of cur-layer
      let min = cnnLayerMinMax$1[curLayerIndex - 1].min,
        max = cnnLayerMinMax$1[curLayerIndex - 1].max;

      // Selected node
      let n = cnn$1[curLayerIndex][i];
      for (let r = 0; r < n.output.length; r++) {
        for (let c = 0; c < n.output[0].length; c++) {
          if (n.output[r][c] < min) { min = n.output[r][c]; }
          if (n.output[r][c] > max) { max = n.output[r][c]; }
        }
      }

      return {range: range, minMax: {min: min, max: max}};
    };

    /**
     * Draw the intermediate layer before conv_1_1
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv1 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {
      // Compute the target location
      let targetX = nodeCoordinate$2[curLayerIndex - 1][0].x + 2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2;
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;
      let leftX = nodeCoordinate$2[curLayerIndex - 1][0].x;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_1_1'] = targetX + nodeLength$4;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Move the selected layer
      moveLayerX({layerIndex: curLayerIndex, targetX: targetX, disable: true,
        delay: 0, opacity: fadedLayerOpacity, specialIndex: i});

      // Compute the gap in the right shrink region
      let rightStart = targetX + nodeLength$4 + hSpaceAroundGap$1 * gapRatio$1;
      let rightGap = (width - rightStart - 10 * nodeLength$4) / 10;

      // Move the right layers
      for (let i = curLayerIndex + 1; i < cnn$1.length; i++) {
        let curX = rightStart + (i - (curLayerIndex + 1)) * (nodeLength$4 + rightGap);
        moveLayerX({
          layerIndex: i,
          targetX: curX,
          disable: true,
          delay: 0,
          opacity: 0.15
        });
      }

      // Keep left-side non-expanded layers (e.g., relu_1) visibly dimmed too.
      for (let i = 0; i < curLayerIndex - 1; i++) {
        moveLayerX({
          layerIndex: i,
          targetX: nodeCoordinate$2[i][0].x,
          disable: true,
          delay: 0,
          opacity: 0.15
        });
      }

      // Add an overlay gradient and rect
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
      {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
      {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient', stops);

      addOverlayRect('overlay-gradient', rightStart - overlayRectOffset / 2,
      0, width - rightStart + overlayRectOffset,
      height + svgPaddings$2.top + svgPaddings$2.bottom);

      // Draw the intermediate layer
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
      drawIntermediateLayer(curLayerIndex, leftX, targetX, rightStart,
        intermediateGap, d, i, intermediateNodeMouseOverHandler,
        intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 8,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);

      // Compute the selected node's min max
      // Selected node
      let min = Infinity, max = -Infinity;
      let n = cnn$1[curLayerIndex][i];
      for (let r = 0; r < n.output.length; r++) {
      for (let c = 0; c < n.output[0].length; c++) {
        if (n.output[r][c] < min) { min = n.output[r][c]; }
        if (n.output[r][c] > max) { max = n.output[r][c]; }
      }
      }

      let finalMinMax = {
      min: Math.min(min, intermediateMinMax.min),
      max: Math.max(max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
      .attr('class', 'intermediate-layer-annotation')
      .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        isFirstConv: true,
        i: i
      });

      let range = cnnLayerRanges$1.local[curLayerIndex];

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: 1,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        isInput: true,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10 - 25
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        minMax: finalMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: nodeCoordinate$2[curLayerIndex - 1][2].x,
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Draw the intermediate layer before conv_1_2
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv2 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {
      let targetX = nodeCoordinate$2[curLayerIndex - 1][0].x + 2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2;
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_1_2'] = targetX + nodeLength$4;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Make sure two layers have the same range
      let {range, minMax} = redrawLayerIfNeeded(curLayerIndex, i);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Move the selected layer
      moveLayerX({layerIndex: curLayerIndex, targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the gap in the right shrink region
      let rightStart = targetX + nodeLength$4 + hSpaceAroundGap$1 * gapRatio$1;
      let rightGap = (width - rightStart - 8 * nodeLength$4) / 8;

      // Move the right layers
      for (let i = curLayerIndex + 1; i < cnn$1.length; i++) {
        let curX = rightStart + (i - (curLayerIndex + 1)) * (nodeLength$4 + rightGap);
        moveLayerX({
          layerIndex: i,
          targetX: curX,
          disable: true,
          delay: 0,
          opacity: fadedLayerOpacity
        });

        svg$3.selectAll(`g#layer-label-${i}, g#layer-detailed-label-${i}`)
          .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
          .style('opacity', fadedLayerOpacity);
      }

      // Fade left-side non-expanded layers (e.g. relu_1).
      for (let i = 0; i < curLayerIndex - 1; i++) {
        moveLayerX({
          layerIndex: i,
          targetX: nodeCoordinate$2[i][0].x,
          disable: true,
          delay: 0,
          opacity: fadedLayerOpacity
        });

        svg$3.selectAll(`g#layer-label-${i}, g#layer-detailed-label-${i}`)
          .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
          .style('opacity', fadedLayerOpacity);
      }

      // Keep the two expanded layers' headings fully visible.
      svg$3.selectAll(`g#layer-label-${curLayerIndex - 1}, g#layer-detailed-label-${curLayerIndex - 1},
    g#layer-label-${curLayerIndex}, g#layer-detailed-label-${curLayerIndex}`)
        .style('opacity', null);

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);

      let leftRightRatio = (2 * nodeLength$4 + hSpaceAroundGap$1 * gapRatio$1) /
        (8 * nodeLength$4 + intermediateGap * 7);
      let endingGradient = 0.85 + (0.95 - 0.85) * leftRightRatio;
      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: endingGradient},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      addOverlayRect('overlay-gradient-right', rightStart - overlayRectOffset / 2,
        0, width - rightStart + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);

      addOverlayRect('overlay-gradient-left', nodeCoordinate$2[0][0].x - overlayRectOffset / 2,
        0, nodeLength$4 * 2 + hSpaceAroundGap$1 * gapRatio$1 + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);

      // Draw the intermediate layer
      let leftX = nodeCoordinate$2[curLayerIndex - 1][0].x;
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
        drawIntermediateLayer(curLayerIndex, leftX, targetX, rightStart,
          intermediateGap, d, i, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 5,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);

      // After getting the intermediateMinMax, we can finally aggregate it with
      // the preLayer minmax, curLayer minmax
      let finalMinMax = {
        min: Math.min(minMax.min, intermediateMinMax.min),
        max: Math.max(minMax.max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        i: i
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        minMax: finalMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Draw the intermediate layer before conv_2_1
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv3 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {

      let targetX = nodeCoordinate$2[curLayerIndex][0].x;
      let leftX = targetX - (2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2);
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_2_1'] = targetX + nodeLength$4;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Make sure two layers have the same range
      let {range, minMax} = redrawLayerIfNeeded(curLayerIndex, i);

      // Move the previous layer
      moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX,
        disable: true, delay: 0});

      moveLayerX({layerIndex: curLayerIndex,
        targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the shift for the left region. The previous layer is moved to leftX,
      // and every layer further left follows the same leftward displacement.
      let leftEnd = leftX - hSpaceAroundGap$1;
      let leftShift = Math.max(0, nodeCoordinate$2[curLayerIndex - 1][0].x - leftX);
      let rightStart = nodeCoordinate$2[curLayerIndex][0].x +
        nodeLength$4 + hSpaceAroundGap$1;

      // Move the left layers
      for (let i = 0; i < curLayerIndex - 1; i++) {
        let curX = nodeCoordinate$2[i][0].x - leftShift;
        moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
      }

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.9},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);

      addOverlayRect('overlay-gradient-left', nodeCoordinate$2[0][0].x - overlayRectOffset / 2,
        0, leftEnd - nodeCoordinate$2[0][0].x + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      addOverlayRect('overlay-gradient-right', rightStart - overlayRectOffset / 2,
        0, width - rightStart + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      // Draw the intermediate layer
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
        drawIntermediateLayer(curLayerIndex, leftX,
          nodeCoordinate$2[curLayerIndex][0].x, rightStart, intermediateGap,
          d, i, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 5,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);
              
      // After getting the intermediateMinMax, we can finally aggregate it with
      // the preLayer minmax, curLayer minmax
      let finalMinMax = {
        min: Math.min(minMax.min, intermediateMinMax.min),
        max: Math.max(minMax.max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        i: i
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        minMax: finalMinMax,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /**
     * Draw the intermediate layer before conv_2_2
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     * @param {function} intermediateNodeMouseOverHandler mouse over handler
     * @param {function} intermediateNodeMouseLeaveHandler mouse leave handler
     * @param {function} intermediateNodeClicked node clicking handler
     */
    const drawConv4 = (curLayerIndex, d, i, width, height,
      intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
      intermediateNodeClicked) => {
      let targetX = nodeCoordinate$2[curLayerIndex][0].x;
      let leftX = targetX - (2 * nodeLength$4 +
        2 * hSpaceAroundGap$1 * gapRatio$1 + plusSymbolRadius * 2);
      let intermediateGap = (hSpaceAroundGap$1 * gapRatio$1 * 2) / 3;

      // Record the left x position for dynamic detial view positioning
      intermediateLayerPosition['conv_2_2'] = leftX;
      intermediateLayerPositionStore.set(intermediateLayerPosition);

      // Hide the edges
      svg$3.select('g.edge-group')
        .style('visibility', 'hidden');

      // Make sure two layers have the same range
      let {range, minMax} = redrawLayerIfNeeded(curLayerIndex, i);

      // Move the previous layer
      moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX,
        disable: true, delay: 0});

      moveLayerX({layerIndex: curLayerIndex,
        targetX: targetX, disable: true,
        delay: 0, opacity: 0.15, specialIndex: i});

      // Compute the shift for the left region. The previous layer is moved to leftX,
      // and every layer further left follows the same leftward displacement.
      let leftEnd = leftX - hSpaceAroundGap$1;
      let leftShift = Math.max(0, nodeCoordinate$2[curLayerIndex - 1][0].x - leftX);
      let rightStart = targetX + nodeLength$4 + hSpaceAroundGap$1;

      // Move the left layers
      for (let i = 0; i < curLayerIndex - 1; i++) {
        let curX = nodeCoordinate$2[i][0].x - leftShift;
        moveLayerX({layerIndex: i, targetX: curX, disable: true, delay: 0});
      }

      // Add an overlay
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.95},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);

      addOverlayRect('overlay-gradient-left', nodeCoordinate$2[0][0].x - overlayRectOffset / 2,
        0, leftEnd - nodeCoordinate$2[0][0].x + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      addOverlayRect('overlay-gradient-right', rightStart - overlayRectOffset / 2,
        0, width - rightStart + overlayRectOffset,
        height + svgPaddings$2.top + svgPaddings$2.bottom);
      
      // Draw the intermediate layer
      let {intermediateLayer, intermediateMinMax, kernelRange, kernelMinMax} =
        drawIntermediateLayer(curLayerIndex, leftX,
          nodeCoordinate$2[curLayerIndex][0].x, rightStart, intermediateGap,
          d, i, intermediateNodeMouseOverHandler,
          intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
      addUnderneathRect(curLayerIndex, i, leftX, intermediateGap, 5,
        intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
        intermediateNodeClicked);
              
      // After getting the intermediateMinMax, we can finally aggregate it with
      // the preLayer minmax, curLayer minmax
      let finalMinMax = {
        min: Math.min(minMax.min, intermediateMinMax.min),
        max: Math.max(minMax.max, intermediateMinMax.max)
      };

      // Add annotation to the intermediate layer
      let intermediateLayerAnnotation = svg$3.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 0);

      drawIntermediateLayerAnnotation({
        leftX: leftX,
        curLayerIndex: curLayerIndex,
        group: intermediateLayerAnnotation,
        intermediateGap: intermediateGap,
        i: i
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: range,
        group: intermediateLayer,
        minMax: finalMinMax,
        width: 2 * nodeLength$4 + intermediateGap,
        x: leftX,
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10
      });

      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex: curLayerIndex,
        range: kernelRange,
        minMax: kernelMinMax,
        group: intermediateLayer,
        width: 2 * nodeLength$4 + intermediateGap,
        x: targetX + nodeLength$4 - (2 * nodeLength$4 + intermediateGap),
        y: svgPaddings$2.top + vSpaceAroundGap$1 * (10) + vSpaceAroundGap$1 + 
          nodeLength$4 * 10,
        gradientAppendingName: 'kernelColorGradient',
        colorScale: layerColorScales$4.weight,
        gradientGap: 0.2
      });

      // Show everything
      svg$3.selectAll('g.intermediate-layer, g.intermediate-layer-annotation')
        .transition()
        .delay(500)
        .duration(500)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /* global d3, SmoothScroll */

    // Configs
    const layerColorScales$5 = overviewConfig.layerColorScales;
    const nodeLength$5 = overviewConfig.nodeLength;
    const plusSymbolRadius$1 = overviewConfig.plusSymbolRadius;
    const intermediateColor$2 = overviewConfig.intermediateColor;
    const edgeInitColor$1 = overviewConfig.edgeInitColor;
    const svgPaddings$3 = overviewConfig.svgPaddings;
    const gapRatio$2 = overviewConfig.gapRatio;
    const formater$2 = d3.format('.4f');
    const fadedLayerOpacity$1 = 0.15;

    // Shared variables
    let svg$4 = undefined;
    svgStore.subscribe( value => {svg$4 = value;} );

    let vSpaceAroundGap$2 = undefined;
    vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap$2 = value;} );

    let hSpaceAroundGap$2 = undefined;
    hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap$2 = value;} );

    let cnn$2 = undefined;
    cnnStore.subscribe( value => {cnn$2 = value;} );

    let nodeCoordinate$3 = undefined;
    nodeCoordinateStore.subscribe( value => {nodeCoordinate$3 = value;} );

    let selectedScaleLevel$2 = undefined;
    selectedScaleLevelStore.subscribe( value => {selectedScaleLevel$2 = value;} );

    let cnnLayerRanges$2 = undefined;
    cnnLayerRangesStore.subscribe( value => {cnnLayerRanges$2 = value;} );

    let cnnLayerMinMax$2 = undefined;
    cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax$2 = value;} );
    isInSoftmaxStore.subscribe( value => {} );
    allowsSoftmaxAnimationStore.subscribe( value => {} );
    softmaxDetailViewStore.subscribe( value => {} );
    hoverInfoStore.subscribe( value => {} );
    detailedModeStore.subscribe( value => {} );

    /**
     * Draw the flatten layer before output layer
     * @param {number} curLayerIndex Index of the selected layer
     * @param {object} d Bounded d3 data
     * @param {number} i Index of the selected node
     * @param {number} width CNN group width
     * @param {number} height CNN group height
     */
    const drawFlatten = (curLayerIndex, d, i, width, height) => {
      const clampNonNegative = (value) => Math.max(0, Number(value) || 0);
      const flattenLayer = cnn$2.flatten || [];
      if (!flattenLayer.length || !nodeCoordinate$3[curLayerIndex - 1]) {
        return;
      }

      svg$4.selectAll('.output-legend').classed('hidden', false);
      svg$4.select('g.edge-group').style('visibility', 'hidden');

      const prevLayerX = nodeCoordinate$3[curLayerIndex - 1][0].x;
      const curLayerX = nodeCoordinate$3[curLayerIndex][0].x;
      const desiredGap = nodeLength$5 + hSpaceAroundGap$2 * gapRatio$2;
      const leftX = prevLayerX - desiredGap;
      const longGap = hSpaceAroundGap$2 * gapRatio$2;
      const nextLayerX = nodeCoordinate$3[curLayerIndex + 1] && nodeCoordinate$3[curLayerIndex + 1][0]
        ? nodeCoordinate$3[curLayerIndex + 1][0].x
        : curLayerX + longGap;
      const targetNextLayerX = curLayerX + longGap;
      const rightShift = targetNextLayerX - nextLayerX;
      const leftShift = Math.max(0, prevLayerX - leftX);

      moveLayerX({layerIndex: curLayerIndex - 1, targetX: leftX, disable: true, delay: 0});
      moveLayerX({
        layerIndex: curLayerIndex,
        targetX: curLayerX,
        disable: true,
        delay: 0,
        opacity: fadedLayerOpacity$1,
        specialIndex: i
      });

      for (let li = 0; li < curLayerIndex - 1; li++) {
        let leftTargetX = nodeCoordinate$3[li][0].x - leftShift;
        moveLayerX({
          layerIndex: li,
          targetX: leftTargetX,
          disable: true,
          delay: 0
        });

        svg$4.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
          .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
          .style('opacity', fadedLayerOpacity$1);
      }

      for (let li = curLayerIndex + 1; li < cnn$2.length; li++) {
        let targetX = nodeCoordinate$3[li][0].x + rightShift;
        moveLayerX({
          layerIndex: li,
          targetX: targetX,
          disable: true,
          delay: 0,
          opacity: fadedLayerOpacity$1
        });

        svg$4.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
          .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
          .style('opacity', fadedLayerOpacity$1);
      }

      // Keep expanded layers' headings fully visible.
      svg$4.selectAll(`g#layer-label-${curLayerIndex - 1}, g#layer-detailed-label-${curLayerIndex - 1},
    g#layer-label-${curLayerIndex}, g#layer-detailed-label-${curLayerIndex}`)
        .style('opacity', null);

      const stops = [
        {offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.86}
      ];
      addOverlayGradient('overlay-gradient-left', stops);

      let intermediateLayerOverlay = svg$4.append('g')
        .attr('class', 'intermediate-layer-overlay');

      intermediateLayerOverlay.append('rect')
        .attr('class', 'overlay')
        .style('fill', 'url(#overlay-gradient-left)')
        .style('stroke', 'none')
        .attr('width', clampNonNegative(leftX + svgPaddings$3.left - 14))
        .attr('height', height + svgPaddings$3.top + svgPaddings$3.bottom)
        .attr('x', -svgPaddings$3.left)
        .attr('y', 0)
        .style('opacity', 0)
        .transition('fade-in')
        .duration(300)
        .style('opacity', 1);

      let intermediateLayer = svg$4.append('g')
        .attr('class', 'intermediate-layer')
        .style('opacity', 0);

      const selectedNode = cnn$2[curLayerIndex][i];
      const selectedLinks = flattenLayer
        .map(flatNode => {
          const link = flatNode.outputLinks.find(outLink =>
            outLink.dest.layerName === selectedNode.layerName &&
            outLink.dest.index === selectedNode.index
          );
          if (!link) return null;
          return { flatNode, weight: link.weight };
        })
        .filter(Boolean)
        // Keep flatten features in channel blocks: [0..48], [49..97], ...
        // using the precomputed channel-major real index.
        .sort((a, b) => {
          let aIndex = Number.isFinite(a.flatNode.realIndex)
            ? a.flatNode.realIndex
            : a.flatNode.index;
          let bIndex = Number.isFinite(b.flatNode.realIndex)
            ? b.flatNode.realIndex
            : b.flatNode.index;
          return aIndex - bIndex;
        });

      const sourceData = selectedLinks.length > 0
        ? selectedLinks
        : flattenLayer.slice(0, Math.min(120, flattenLayer.length)).map(flatNode => ({
          flatNode,
          weight: 0
        }));

      const sampleCount = sourceData.length;
      const topY = nodeCoordinate$3[curLayerIndex - 1][0].y;
      const bottomY = nodeCoordinate$3[curLayerIndex - 1][nodeCoordinate$3[curLayerIndex - 1].length - 1].y + nodeLength$5;
      const stripX = leftX + nodeLength$5 + hSpaceAroundGap$2 * gapRatio$2 * 0.8;
      const stripW = Math.max(8, nodeLength$5 * 0.42);
      const symbolX = stripX + hSpaceAroundGap$2 * gapRatio$2 * 0.85;
      const symbolY = nodeCoordinate$3[curLayerIndex][i].y + nodeLength$5 / 2;
      const rowH = Math.max(1.2, (bottomY - topY) / sampleCount);
      const preLayerDimension = cnn$2[curLayerIndex - 1][0].output.length;
      const preLayerGap = nodeLength$5 / (2 * preLayerDimension);

      const sampled = sourceData.slice();

      const valExtent = d3.extent(sampled.map(entry => entry.flatNode.output));
      const valueRange = Math.max(Math.abs(valExtent[0] || 0), Math.abs(valExtent[1] || 0));
      const colorScale = layerColorScales$5.conv;

      const linkGen = d3.linkHorizontal().x(v => v.x).y(v => v.y);

      const strip = intermediateLayer.append('g').attr('class', 'flatten-layer');
      strip.selectAll('rect.flatten-strip-cell')
        .data(sampled)
        .enter()
        .append('rect')
        .attr('class', 'flatten-strip-cell')
        .attr('x', stripX)
        .attr('y', (entry, si) => topY + si * rowH)
        .attr('width', stripW)
        .attr('height', rowH)
        .style('fill', entry => colorScale(((entry.flatNode.output || 0) + valueRange) / Math.max(1e-6, 2 * valueRange)))
        .style('cursor', 'crosshair')
        .on('mouseover', entry => {
          hoverInfoStore.set({
            show: true,
            text: `flatten[${entry.flatNode.index}] = ${formater$2(entry.flatNode.output)}`
          });
        })
        .on('mouseleave', () => hoverInfoStore.set({show: false, text: ''}))
        .on('click', () => d3.event.stopPropagation());

      strip.selectAll('path.flatten-to-bottleneck')
        .data(sampled)
        .enter()
        .append('path')
        .attr('class', 'flatten-to-bottleneck')
        .attr('d', (entry, si) => linkGen({
          source: {x: stripX + stripW + 3, y: topY + si * rowH + rowH / 2},
          target: {x: symbolX - plusSymbolRadius$1 - 2, y: symbolY}
        }))
        .style('fill', 'none')
        .style('stroke', entry => gappedColorScale(layerColorScales$5.weight, 2, entry.weight || 0, 0.25))
        .style('stroke-width', 0.8)
        .style('opacity', 0.8);

      // Render max_pool_2 -> flatten edges using flatten location metadata
      // (same mapping idea as the original CNN explainer implementation).
      const maxPoolToFlatten = sampled
        .map((entry, si) => {
          let inputLink = entry.flatNode && entry.flatNode.inputLinks
            ? entry.flatNode.inputLinks[0]
            : undefined;
          let loc = inputLink && Array.isArray(inputLink.weight)
            ? inputLink.weight
            : [0, 0];
          let row = loc[0] || 0;
          let preNodeIndex = inputLink && inputLink.source ? inputLink.source.index : 0;
          preNodeIndex = Math.max(0, Math.min(preNodeIndex, nodeCoordinate$3[curLayerIndex - 1].length - 1));
          return {
            source: {
              x: leftX + nodeLength$5 + 3,
              y: nodeCoordinate$3[curLayerIndex - 1][preNodeIndex].y + (2 * row + 1) * preLayerGap
            },
            target: {
              x: stripX - 2,
              y: topY + si * rowH + rowH / 2
            }
          };
        });

      strip.selectAll('path.maxpool-to-flatten')
        .data(maxPoolToFlatten)
        .enter()
        .append('path')
        .attr('class', 'maxpool-to-flatten')
        .attr('d', e => linkGen({source: e.source, target: e.target}))
        .style('fill', 'none')
        .style('stroke', edgeInitColor$1)
        .style('stroke-width', 0.8)
        .style('opacity', 1);

      let symbolGroup = strip.append('g')
        .attr('class', 'plus-symbol')
        .attr('transform', `translate(${symbolX}, ${symbolY})`);

      symbolGroup.append('rect')
        .attr('x', -plusSymbolRadius$1)
        .attr('y', -plusSymbolRadius$1)
        .attr('width', 2 * plusSymbolRadius$1)
        .attr('height', 2 * plusSymbolRadius$1)
        .attr('rx', 3)
        .style('fill', 'none')
        .style('stroke', intermediateColor$2);

      symbolGroup.append('rect')
        .attr('x', -(plusSymbolRadius$1 - 3))
        .attr('y', -0.5)
        .attr('width', 2 * (plusSymbolRadius$1 - 3))
        .attr('height', 1)
        .style('fill', intermediateColor$2);

      symbolGroup.append('rect')
        .attr('x', -0.5)
        .attr('y', -(plusSymbolRadius$1 - 3))
        .attr('width', 1)
        .attr('height', 2 * (plusSymbolRadius$1 - 3))
        .style('fill', intermediateColor$2);

      strip.append('path')
        .attr('d', linkGen({
          source: {x: symbolX + plusSymbolRadius$1 + 2, y: symbolY},
          // Shorten only this single edge (plus/bias -> bottleneck input).
          target: {x: nodeCoordinate$3[curLayerIndex][i].x - 2, y: symbolY}
        }))
        .style('fill', 'none')
        .style('stroke', edgeInitColor$1)
        .style('stroke-width', 1.2);

      const preRange = cnnLayerRanges$2[selectedScaleLevel$2][curLayerIndex - 1] || 1;
      drawIntermediateLayerLegend({
        legendHeight: 5,
        curLayerIndex,
        range: preRange,
        minMax: cnnLayerMinMax$2[curLayerIndex - 1],
        group: intermediateLayer,
        width: nodeLength$5 + hSpaceAroundGap$2,
        x: leftX,
        y: svgPaddings$3.top + vSpaceAroundGap$2 * (10) + vSpaceAroundGap$2 + nodeLength$5 * 10
      });

      svg$4.append('g')
        .attr('class', 'intermediate-layer-annotation')
        .style('opacity', 1)
        .append('text')
        .attr('class', 'annotation-text')
        .attr('x', stripX - 20)
        .attr('y', topY - 20)
        .style('text-anchor', 'start')
        .style('dominant-baseline', 'hanging')
        .text('flatten(784)');

      intermediateLayer.transition()
        .duration(320)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1);
    };

    /* global d3 */

    const nodeLength$6 = overviewConfig.nodeLength;
    const svgPaddings$4 = overviewConfig.svgPaddings;
    const gapRatio$3 = overviewConfig.gapRatio;

    let svg$5 = undefined;
    svgStore.subscribe(value => { svg$5 = value; });

    let cnn$3 = undefined;
    cnnStore.subscribe(value => { cnn$3 = value; });

    let nodeCoordinate$4 = undefined;
    nodeCoordinateStore.subscribe(value => { nodeCoordinate$4 = value; });

    let detailedMode$2 = undefined;
    detailedModeStore.subscribe(value => { detailedMode$2 = value; });

    let hSpaceAroundGap$3 = undefined;
    hSpaceAroundGapStore.subscribe(value => { hSpaceAroundGap$3 = value; });

    const toNumber = (value) => {
      if (Array.isArray(value)) return 0;
      if (value === undefined || value === null) return 0;
      return Number(value);
    };

    const clampNonNegative$1 = (value) => Math.max(0, Number(value) || 0);

    const findLayerIndex = (layerName) => {
      for (let i = 0; i < cnn$3.length; i++) {
        if (cnn$3[i] && cnn$3[i][0] && cnn$3[i][0].layerName === layerName) {
          return i;
        }
      }
      return -1;
    };

    const drawFcToUnflatten = (d, nodeIndex, width, height) => {
      if (!svg$5 || !cnn$3 || !nodeCoordinate$4) return;

      let intermediateLayer = svg$5.select('.intermediate-layer');
      if (intermediateLayer.empty()) {
        intermediateLayer = svg$5.append('g')
          .attr('class', 'intermediate-layer')
          .style('opacity', 1);
      }

      intermediateLayer.selectAll('.reshape-flow-layer').remove();

      let curLayerIndex = findLayerIndex(d.layerName);
      if (curLayerIndex < 2) return;

      let bottleneckIndex = findLayerIndex('bottleneck');
      if (bottleneckIndex < 0) {
        bottleneckIndex = curLayerIndex - 1;
      }
      let fcIndex = curLayerIndex - 1;

      let selectedLinks = (d.inputLinks || [])
        .filter(link => link && link.source && Array.isArray(link.weight) && link.weight.length >= 3)
        .sort((a, b) => a.weight[2] - b.weight[2])
        .slice(0, 49);
      if (selectedLinks.length === 0) return;

      let fcNodes = selectedLinks.map(link => link.source);
      let bottleneckNodes = cnn$3[bottleneckIndex];
      if (!bottleneckNodes || bottleneckNodes.length === 0) return;
      if (!nodeCoordinate$4[bottleneckIndex] || !nodeCoordinate$4[bottleneckIndex][0]) return;
      if (!nodeCoordinate$4[curLayerIndex] || !nodeCoordinate$4[curLayerIndex][nodeIndex]) return;
      if (!nodeCoordinate$4[fcIndex] || nodeCoordinate$4[fcIndex].length === 0) return;

      let bottleneckX = nodeCoordinate$4[bottleneckIndex][0].x;
      let outputX = nodeCoordinate$4[curLayerIndex][nodeIndex].x;

      svg$5.select('g.edge-group').style('visibility', 'hidden');

      // Base overview layout uses a "long gap" before conv and bottleneck layers.
      // max_pool_1->conv_2, max_pool_2->bottleneck and upsample_1->conv_3 all use it.
      // Force bottleneck->unflatten to exactly this same long-gap spacing.
      let longGap = hSpaceAroundGap$3 * gapRatio$3;
      let targetUnflattenX = bottleneckX + longGap;
      let shift = targetUnflattenX - outputX;

      // Keep bottleneck and all layers to its left fixed; move unflatten and
      // everything to the right so only bottleneck <-> unflatten spacing changes.
      for (let li = curLayerIndex; li < cnn$3.length; li++) {
        if (!nodeCoordinate$4[li] || !nodeCoordinate$4[li][0]) { continue; }
        moveLayerX({
          layerIndex: li,
          targetX: nodeCoordinate$4[li][0].x + shift,
          disable: true,
          delay: 0,
          opacity: li === curLayerIndex ? 0.2 : undefined,
          specialIndex: li === curLayerIndex ? nodeIndex : undefined
        });
      }
      outputX = targetUnflattenX;

      addOverlayGradient('overlay-gradient-reshape', [
        {offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.88},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}
      ]);
      addOverlayRect(
        'overlay-gradient-reshape',
        bottleneckX + nodeLength$6 + hSpaceAroundGap$3 * 0.4,
        0,
        Math.max(0, outputX - bottleneckX),
        (height || 0) + svgPaddings$4.top + svgPaddings$4.bottom
      );

      let leftX = bottleneckX + nodeLength$6 + Math.max(20, (outputX - bottleneckX - nodeLength$6) * 0.15);
      let midX = leftX + (outputX - leftX - nodeLength$6) * 0.52;
      let matrixX = midX - 10;
      let topY = nodeCoordinate$4[fcIndex][0].y;
      let bottomY = nodeCoordinate$4[fcIndex][nodeCoordinate$4[fcIndex].length - 1].y + nodeLength$6;
      let rowHeight = (bottomY - topY) / Math.max(1, fcNodes.length);
      let linkGen = d3.linkHorizontal().x(v => v.x).y(v => v.y);

      let layer = intermediateLayer.append('g')
        .attr('class', 'reshape-flow-layer')
        .style('opacity', 0);

      let fcToTarget = [];
      let fcRects = [];

      fcNodes.forEach((node, idx) => {
        let cy = topY + idx * rowHeight + rowHeight / 2;
        let row = node.index % 7;
        let col = Math.floor((node.index % 49) / 7);

        fcRects.push({
          idx,
          row,
          col,
          x: matrixX,
          y: topY + idx * rowHeight,
          value: toNumber(node.output),
          node
        });

        fcToTarget.push({
          source: { x: matrixX + 11, y: cy },
          target: { x: outputX - 4, y: nodeCoordinate$4[curLayerIndex][nodeIndex].y + nodeLength$6 / 2 },
          className: idx === 0 || idx === 48 ? 'reshape-edge-solid' : 'reshape-edge-fade'
        });
      });

      // Draw top and bottom detail strips with abstract middle, mirroring flatten style.
      let topRows = fcRects.slice(0, 7);
      let bottomRows = fcRects.slice(42, 49);
      let middleRows = fcRects.slice(7, 42);

      let colorScale = d3.scaleLinear()
        .domain(d3.extent(fcRects.map(v => v.value)))
        .range(['#f2f2f2', '#7bccc4']);

      layer.selectAll('rect.fc-row-top')
        .data(topRows)
        .enter()
        .append('rect')
        .attr('class', 'fc-row-top')
        .attr('x', r => r.x)
        .attr('y', r => r.y)
        .attr('width', 11)
        .attr('height', rowHeight * 0.92)
        .style('fill', r => colorScale(r.value))
        .style('cursor', 'crosshair')
        .on('mouseover', r => {
          hoverInfoStore.set({ show: true, text: `fc_layer[${r.node.index}] = ${r.value.toFixed(4)}` });
        })
        .on('mouseleave', () => hoverInfoStore.set({ show: false, text: '' }))
        .on('click', () => { d3.event.stopPropagation(); });

      layer.selectAll('rect.fc-row-bottom')
        .data(bottomRows)
        .enter()
        .append('rect')
        .attr('class', 'fc-row-bottom')
        .attr('x', r => r.x)
        .attr('y', r => r.y)
        .attr('width', 11)
        .attr('height', rowHeight * 0.92)
        .style('fill', r => colorScale(r.value))
        .style('cursor', 'crosshair')
        .on('mouseover', r => {
          hoverInfoStore.set({ show: true, text: `fc_layer[${r.node.index}] = ${r.value.toFixed(4)}` });
        })
        .on('mouseleave', () => hoverInfoStore.set({ show: false, text: '' }))
        .on('click', () => { d3.event.stopPropagation(); });

      let middleBins = [];
      for (let i = 0; i < 7; i++) {
        let bin = middleRows.slice(i * 5, (i + 1) * 5);
        middleBins.push({
          y: bin.length > 0 ? bin[0].y : topY,
          h: Math.max(2, rowHeight * Math.max(1, bin.length) * 0.75),
          value: d3.mean(bin.map(v => v.value))
        });
      }

      layer.selectAll('rect.fc-row-middle')
        .data(middleBins)
        .enter()
        .append('rect')
        .attr('class', 'fc-row-middle')
        .attr('x', matrixX + 2)
        .attr('y', r => r.y)
        .attr('width', 7)
        .attr('height', r => r.h)
        .style('fill', '#E5E5E5');

      let bottleneckEdgeData = [];
      bottleneckNodes.forEach((bn, bi) => {
        let by = nodeCoordinate$4[bottleneckIndex][bi].y + nodeLength$6 / 2;
        let fcSampleIndices = [0, 8, 16, 24, 32, 40, 48];
        fcSampleIndices.forEach(fi => {
          let fcNode = fcNodes[fi];
          let weight = toNumber(fcNode.inputLinks && fcNode.inputLinks[bi] ? fcNode.inputLinks[bi].weight : 0);
          let fcy = topY + fi * rowHeight + rowHeight / 2;
          bottleneckEdgeData.push({
            source: { x: nodeCoordinate$4[bottleneckIndex][bi].x + nodeLength$6 + 3, y: by },
            target: { x: matrixX - 3, y: fcy },
            weight
          });
        });
      });

      layer.append('g')
        .attr('class', 'reshape-bottleneck-edges')
        .selectAll('path')
        .data(bottleneckEdgeData)
        .enter()
        .append('path')
        .attr('d', e => linkGen({ source: e.source, target: e.target }))
        .style('fill', 'none')
        .style('stroke', '#ECECEC')
        .style('stroke-width', 0.6)
        .style('opacity', 0)
        .each(function() {
          let len = this.getTotalLength();
          d3.select(this)
            .attr('stroke-dasharray', `${len} ${len}`)
            .attr('stroke-dashoffset', len)
            .transition('reshape-stage-1')
            .delay(100)
            .duration(550)
            .style('opacity', 1)
            .attr('stroke-dashoffset', 0);
        });

      layer.append('g')
        .attr('class', 'reshape-fc-output-edges')
        .selectAll('path')
        .data(fcToTarget)
        .enter()
        .append('path')
        .attr('d', e => linkGen({ source: e.source, target: e.target }))
        .style('fill', 'none')
        .style('stroke', e => e.className === 'reshape-edge-solid' ? '#D8D8D8' : '#ECECEC')
        .style('stroke-width', e => e.className === 'reshape-edge-solid' ? 1 : 0.6)
        .style('opacity', 0)
        .each(function() {
          let len = this.getTotalLength();
          d3.select(this)
            .attr('stroke-dasharray', `${len} ${len}`)
            .attr('stroke-dashoffset', len)
            .transition('reshape-stage-2')
            .delay(620)
            .duration(620)
            .style('opacity', 1)
            .attr('stroke-dashoffset', 0);
        });

      layer.append('path')
        .attr('d', linkGen({
          source: { x: outputX - 4, y: nodeCoordinate$4[curLayerIndex][nodeIndex].y + nodeLength$6 / 2 },
          target: getInputKnot(nodeCoordinate$4[curLayerIndex][nodeIndex])
        }))
        .style('fill', 'none')
        .style('stroke', '#D8D8D8')
        .style('stroke-width', 1);

      let label = layer.append('g')
        .attr('class', 'layer-label')
        .classed('hidden', detailedMode$2)
        .attr('transform', `translate(${matrixX + 5}, ${(svgPaddings$4.top + 24)})`)
        .style('cursor', 'help');

      label.append('text')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('opacity', 0.8)
        .style('font-weight', 800)
        .text('reshape');

      let annotation = svg$5.select('.intermediate-layer-annotation');
      if (!annotation.empty()) {
        annotation.append('g')
          .attr('class', 'reshape-annotation')
          .append('text')
          .attr('class', 'annotation-text')
          .attr('x', matrixX - 95)
          .attr('y', topY + 25)
          .style('text-anchor', 'start')
          .style('dominant-baseline', 'hanging')
          .text('49 fc_layer predecessors are rearranged')
          .append('tspan')
          .attr('x', matrixX - 95)
          .attr('dy', '1.2em')
          .text('into the selected unflatten channel map.');
      }

      layer.append('rect')
        .attr('x', leftX - 12)
        .attr('y', topY - 8)
        .attr('width', clampNonNegative$1(outputX - leftX + 20))
        .attr('height', bottomY - topY + 16)
        .style('fill', 'transparent')
        .style('pointer-events', 'all')
        .on('click', () => { d3.event.stopPropagation(); });

      layer.transition('reshape-fade-in')
        .duration(320)
        .style('opacity', 1);
    };

    /* src\overview\Overview.svelte generated by Svelte v3.59.2 */

    const { Error: Error_1, console: console_1$2 } = globals;

    const file$b = "src\\overview\\Overview.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[95] = list[i];
    	child_ctx[97] = i;
    	return child_ctx;
    }

    // (1750:6) {#each imageOptions as image, i}
    function create_each_block(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let img_title_value;
    	let img_data_imagename_value;
    	let t;
    	let div_tabindex_value;
    	let div_data_imagename_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			t = space();
    			attr_dev(img, "class", "digit-option svelte-gf2jrl");
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/" + /*image*/ ctx[95].file)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "digit option");
    			attr_dev(img, "title", img_title_value = /*image*/ ctx[95].class);
    			attr_dev(img, "data-imagename", img_data_imagename_value = /*image*/ ctx[95].file);
    			add_location(img, file$b, 1759, 10, 58179);
    			attr_dev(div, "class", "image-container svelte-gf2jrl");
    			attr_dev(div, "role", "button");
    			attr_dev(div, "tabindex", div_tabindex_value = /*disableControl*/ ctx[4] ? -1 : 0);
    			attr_dev(div, "aria-disabled", /*disableControl*/ ctx[4]);
    			attr_dev(div, "data-imagename", div_data_imagename_value = /*image*/ ctx[95].file);
    			toggle_class(div, "inactive", /*selectedImage*/ ctx[5] !== /*image*/ ctx[95].file);
    			toggle_class(div, "disabled", /*disableControl*/ ctx[4]);
    			add_location(div, file$b, 1750, 8, 57736);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div,
    						"click",
    						function () {
    							if (is_function(/*disableControl*/ ctx[4]
    							? click_handler
    							: /*imageOptionClicked*/ ctx[14])) (/*disableControl*/ ctx[4]
    							? click_handler
    							: /*imageOptionClicked*/ ctx[14]).apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(div, "keydown", /*keydown_handler*/ ctx[21], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*disableControl*/ 16 && div_tabindex_value !== (div_tabindex_value = /*disableControl*/ ctx[4] ? -1 : 0)) {
    				attr_dev(div, "tabindex", div_tabindex_value);
    			}

    			if (dirty[0] & /*disableControl*/ 16) {
    				attr_dev(div, "aria-disabled", /*disableControl*/ ctx[4]);
    			}

    			if (dirty[0] & /*selectedImage, imageOptions*/ 4128) {
    				toggle_class(div, "inactive", /*selectedImage*/ ctx[5] !== /*image*/ ctx[95].file);
    			}

    			if (dirty[0] & /*disableControl*/ 16) {
    				toggle_class(div, "disabled", /*disableControl*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(1750:6) {#each imageOptions as image, i}",
    		ctx
    	});

    	return block;
    }

    // (1810:2) {#if modelLoadNotice.length > 0}
    function create_if_block_5(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*modelLoadNotice*/ ctx[2]);
    			attr_dev(div, "class", "model-notice svelte-gf2jrl");
    			add_location(div, file$b, 1810, 4, 59765);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*modelLoadNotice*/ 4) set_data_dev(t, /*modelLoadNotice*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(1810:2) {#if modelLoadNotice.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1842:71) 
    function create_if_block_4(ctx) {
    	let upsampleview;
    	let current;

    	upsampleview = new Upsampleview({
    			props: {
    				input: /*nodeData*/ ctx[6][0].input,
    				output: /*nodeData*/ ctx[6][0].output,
    				factor: 2,
    				dataRange: /*nodeData*/ ctx[6].colorRange,
    				isExited: /*isExitedFromDetailedView*/ ctx[8]
    			},
    			$$inline: true
    		});

    	upsampleview.$on("message", /*handleExitFromDetiledPoolView*/ ctx[19]);

    	const block = {
    		c: function create() {
    			create_component(upsampleview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(upsampleview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const upsampleview_changes = {};
    			if (dirty[0] & /*nodeData*/ 64) upsampleview_changes.input = /*nodeData*/ ctx[6][0].input;
    			if (dirty[0] & /*nodeData*/ 64) upsampleview_changes.output = /*nodeData*/ ctx[6][0].output;
    			if (dirty[0] & /*nodeData*/ 64) upsampleview_changes.dataRange = /*nodeData*/ ctx[6].colorRange;
    			if (dirty[0] & /*isExitedFromDetailedView*/ 256) upsampleview_changes.isExited = /*isExitedFromDetailedView*/ ctx[8];
    			upsampleview.$set(upsampleview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(upsampleview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(upsampleview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(upsampleview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(1842:71) ",
    		ctx
    	});

    	return block;
    }

    // (1837:67) 
    function create_if_block_3(ctx) {
    	let poolview;
    	let current;

    	poolview = new Poolview({
    			props: {
    				input: /*nodeData*/ ctx[6][0].input,
    				kernelLength: 2,
    				dataRange: /*nodeData*/ ctx[6].colorRange,
    				isExited: /*isExitedFromDetailedView*/ ctx[8]
    			},
    			$$inline: true
    		});

    	poolview.$on("message", /*handleExitFromDetiledPoolView*/ ctx[19]);

    	const block = {
    		c: function create() {
    			create_component(poolview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(poolview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const poolview_changes = {};
    			if (dirty[0] & /*nodeData*/ 64) poolview_changes.input = /*nodeData*/ ctx[6][0].input;
    			if (dirty[0] & /*nodeData*/ 64) poolview_changes.dataRange = /*nodeData*/ ctx[6].colorRange;
    			if (dirty[0] & /*isExitedFromDetailedView*/ 256) poolview_changes.isExited = /*isExitedFromDetailedView*/ ctx[8];
    			poolview.$set(poolview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(poolview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(poolview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(poolview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(1837:67) ",
    		ctx
    	});

    	return block;
    }

    // (1829:70) 
    function create_if_block_2(ctx) {
    	let activationview;
    	let current;

    	activationview = new Activationview({
    			props: {
    				input: /*nodeData*/ ctx[6][0].input,
    				output: /*nodeData*/ ctx[6][0].output,
    				dataRange: /*nodeData*/ ctx[6].colorRange,
    				title: 'Sigmoid Activation',
    				activationType: 'sigmoid',
    				articleAnchor: 'article-relu',
    				isExited: /*isExitedFromDetailedView*/ ctx[8]
    			},
    			$$inline: true
    		});

    	activationview.$on("message", /*handleExitFromDetiledActivationView*/ ctx[20]);

    	const block = {
    		c: function create() {
    			create_component(activationview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(activationview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const activationview_changes = {};
    			if (dirty[0] & /*nodeData*/ 64) activationview_changes.input = /*nodeData*/ ctx[6][0].input;
    			if (dirty[0] & /*nodeData*/ 64) activationview_changes.output = /*nodeData*/ ctx[6][0].output;
    			if (dirty[0] & /*nodeData*/ 64) activationview_changes.dataRange = /*nodeData*/ ctx[6].colorRange;
    			if (dirty[0] & /*isExitedFromDetailedView*/ 256) activationview_changes.isExited = /*isExitedFromDetailedView*/ ctx[8];
    			activationview.$set(activationview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(activationview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(activationview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(activationview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(1829:70) ",
    		ctx
    	});

    	return block;
    }

    // (1824:67) 
    function create_if_block_1(ctx) {
    	let activationview;
    	let current;

    	activationview = new Activationview({
    			props: {
    				input: /*nodeData*/ ctx[6][0].input,
    				output: /*nodeData*/ ctx[6][0].output,
    				dataRange: /*nodeData*/ ctx[6].colorRange,
    				isExited: /*isExitedFromDetailedView*/ ctx[8]
    			},
    			$$inline: true
    		});

    	activationview.$on("message", /*handleExitFromDetiledActivationView*/ ctx[20]);

    	const block = {
    		c: function create() {
    			create_component(activationview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(activationview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const activationview_changes = {};
    			if (dirty[0] & /*nodeData*/ 64) activationview_changes.input = /*nodeData*/ ctx[6][0].input;
    			if (dirty[0] & /*nodeData*/ 64) activationview_changes.output = /*nodeData*/ ctx[6][0].output;
    			if (dirty[0] & /*nodeData*/ 64) activationview_changes.dataRange = /*nodeData*/ ctx[6].colorRange;
    			if (dirty[0] & /*isExitedFromDetailedView*/ 256) activationview_changes.isExited = /*isExitedFromDetailedView*/ ctx[8];
    			activationview.$set(activationview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(activationview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(activationview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(activationview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(1824:67) ",
    		ctx
    	});

    	return block;
    }

    // (1816:2) {#if selectedNode.data && selectedNode.data.type === 'conv' && selectedNodeIndex != -1}
    function create_if_block$5(ctx) {
    	let convolutionview;
    	let current;

    	convolutionview = new Convolutionview({
    			props: {
    				input: /*nodeData*/ ctx[6][/*selectedNodeIndex*/ ctx[7]].input,
    				kernel: /*nodeData*/ ctx[6][/*selectedNodeIndex*/ ctx[7]].kernel,
    				dataRange: /*nodeData*/ ctx[6].colorRange,
    				colorScale: /*nodeData*/ ctx[6].inputIsInputLayer
    				? /*layerColorScales*/ ctx[11].input[0]
    				: /*layerColorScales*/ ctx[11].conv,
    				isInputInputLayer: /*nodeData*/ ctx[6].inputIsInputLayer,
    				isExited: /*isExitedFromCollapse*/ ctx[9]
    			},
    			$$inline: true
    		});

    	convolutionview.$on("message", /*handleExitFromDetiledConvView*/ ctx[18]);

    	const block = {
    		c: function create() {
    			create_component(convolutionview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(convolutionview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const convolutionview_changes = {};
    			if (dirty[0] & /*nodeData, selectedNodeIndex*/ 192) convolutionview_changes.input = /*nodeData*/ ctx[6][/*selectedNodeIndex*/ ctx[7]].input;
    			if (dirty[0] & /*nodeData, selectedNodeIndex*/ 192) convolutionview_changes.kernel = /*nodeData*/ ctx[6][/*selectedNodeIndex*/ ctx[7]].kernel;
    			if (dirty[0] & /*nodeData*/ 64) convolutionview_changes.dataRange = /*nodeData*/ ctx[6].colorRange;

    			if (dirty[0] & /*nodeData*/ 64) convolutionview_changes.colorScale = /*nodeData*/ ctx[6].inputIsInputLayer
    			? /*layerColorScales*/ ctx[11].input[0]
    			: /*layerColorScales*/ ctx[11].conv;

    			if (dirty[0] & /*nodeData*/ 64) convolutionview_changes.isInputInputLayer = /*nodeData*/ ctx[6].inputIsInputLayer;
    			if (dirty[0] & /*isExitedFromCollapse*/ 512) convolutionview_changes.isExited = /*isExitedFromCollapse*/ ctx[9];
    			convolutionview.$set(convolutionview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(convolutionview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(convolutionview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(convolutionview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(1816:2) {#if selectedNode.data && selectedNode.data.type === 'conv' && selectedNodeIndex != -1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div4;
    	let div2;
    	let div1;
    	let t0;
    	let div0;
    	let img;
    	let img_src_value;
    	let t1;
    	let span0;
    	let i0;
    	let t2;
    	let i1;
    	let div0_data_imagename_value;
    	let div0_tabindex_value;
    	let t3;
    	let button;
    	let span1;
    	let i2;
    	let t4;
    	let span2;
    	let t5_value = /*hoverInfo*/ ctx[1].text + "";
    	let t5;
    	let t6;
    	let div3;
    	let svg_1;
    	let t7;
    	let t8;
    	let div5;
    	let current_block_type_index;
    	let if_block1;
    	let t9;
    	let modal;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*imageOptions*/ ctx[12];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block0 = /*modelLoadNotice*/ ctx[2].length > 0 && create_if_block_5(ctx);

    	const if_block_creators = [
    		create_if_block$5,
    		create_if_block_1,
    		create_if_block_2,
    		create_if_block_3,
    		create_if_block_4
    	];

    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*selectedNode*/ ctx[3].data && /*selectedNode*/ ctx[3].data.type === 'conv' && /*selectedNodeIndex*/ ctx[7] != -1) return 0;
    		if (/*selectedNode*/ ctx[3].data && /*selectedNode*/ ctx[3].data.type === 'relu') return 1;
    		if (/*selectedNode*/ ctx[3].data && /*selectedNode*/ ctx[3].data.type === 'sigmoid') return 2;
    		if (/*selectedNode*/ ctx[3].data && /*selectedNode*/ ctx[3].data.type === 'pool') return 3;
    		if (/*selectedNode*/ ctx[3].data && /*selectedNode*/ ctx[3].data.type === 'upsample') return 4;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	modal = new Modal({ $$inline: true });
    	modal.$on("xClicked", /*handleModalCanceled*/ ctx[16]);
    	modal.$on("urlTyped", /*handleCustomImage*/ ctx[17]);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div2 = element("div");
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div0 = element("div");
    			img = element("img");
    			t1 = space();
    			span0 = element("span");
    			i0 = element("i");
    			t2 = space();
    			i1 = element("i");
    			t3 = space();
    			button = element("button");
    			span1 = element("span");
    			i2 = element("i");
    			t4 = space();
    			span2 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			div3 = element("div");
    			svg_1 = svg_element("svg");
    			t7 = space();
    			if (if_block0) if_block0.c();
    			t8 = space();
    			div5 = element("div");
    			if (if_block1) if_block1.c();
    			t9 = space();
    			create_component(modal.$$.fragment);
    			attr_dev(img, "class", "custom-image svelte-gf2jrl");
    			if (!src_url_equal(img.src, img_src_value = "/assets/img/plus.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "plus button");
    			attr_dev(img, "title", "Add new input image");
    			attr_dev(img, "data-imagename", "custom");
    			add_location(img, file$b, 1777, 8, 58851);
    			attr_dev(i0, "class", "fas fa-circle fa-stack-2x");
    			add_location(i0, file$b, 1785, 10, 59136);
    			attr_dev(i1, "class", "fas fa-pen fa-stack-1x fa-inverse");
    			add_location(i1, file$b, 1786, 10, 59189);
    			attr_dev(span0, "class", "fa-stack edit-icon svelte-gf2jrl");
    			toggle_class(span0, "hidden", /*customImageURL*/ ctx[10] === null);
    			add_location(span0, file$b, 1783, 8, 59041);
    			attr_dev(div0, "class", "image-container svelte-gf2jrl");
    			attr_dev(div0, "data-imagename", div0_data_imagename_value = 'custom');
    			attr_dev(div0, "role", "button");
    			attr_dev(div0, "tabindex", div0_tabindex_value = /*disableControl*/ ctx[4] ? -1 : 0);
    			attr_dev(div0, "aria-disabled", /*disableControl*/ ctx[4]);
    			toggle_class(div0, "inactive", /*selectedImage*/ ctx[5] !== 'custom');
    			toggle_class(div0, "disabled", /*disableControl*/ ctx[4]);
    			add_location(div0, file$b, 1767, 6, 58428);
    			attr_dev(i2, "class", "fas fa-crosshairs ");
    			add_location(i2, file$b, 1795, 10, 59479);
    			attr_dev(span1, "class", "icon");
    			set_style(span1, "margin-right", "5px");
    			add_location(span1, file$b, 1794, 8, 59421);
    			attr_dev(span2, "id", "hover-label-text");
    			add_location(span2, file$b, 1797, 8, 59540);
    			attr_dev(button, "class", "button is-very-small is-link is-light svelte-gf2jrl");
    			attr_dev(button, "id", "hover-label");
    			set_style(button, "opacity", /*hoverInfo*/ ctx[1].show ? 1 : 0);
    			add_location(button, file$b, 1791, 6, 59281);
    			attr_dev(div1, "class", "left-control svelte-gf2jrl");
    			add_location(div1, file$b, 1748, 4, 57660);
    			attr_dev(div2, "class", "control-container svelte-gf2jrl");
    			add_location(div2, file$b, 1746, 2, 57621);
    			attr_dev(svg_1, "id", "cnn-svg");
    			attr_dev(svg_1, "class", "svelte-gf2jrl");
    			add_location(svg_1, file$b, 1806, 4, 59687);
    			attr_dev(div3, "class", "cnn svelte-gf2jrl");
    			add_location(div3, file$b, 1805, 2, 59664);
    			attr_dev(div4, "class", "overview svelte-gf2jrl");
    			add_location(div4, file$b, 1743, 0, 57560);
    			attr_dev(div5, "id", "detailview");
    			add_location(div5, file$b, 1814, 0, 59835);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div2);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}

    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div0, t1);
    			append_dev(div0, span0);
    			append_dev(span0, i0);
    			append_dev(span0, t2);
    			append_dev(span0, i1);
    			append_dev(div1, t3);
    			append_dev(div1, button);
    			append_dev(button, span1);
    			append_dev(span1, i2);
    			append_dev(button, t4);
    			append_dev(button, span2);
    			append_dev(span2, t5);
    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, svg_1);
    			append_dev(div4, t7);
    			if (if_block0) if_block0.m(div4, null);
    			/*div4_binding*/ ctx[23](div4);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, div5, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div5, null);
    			}

    			insert_dev(target, t9, anchor);
    			mount_component(modal, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div0,
    						"click",
    						function () {
    							if (is_function(/*disableControl*/ ctx[4]
    							? click_handler_1
    							: /*customImageClicked*/ ctx[15])) (/*disableControl*/ ctx[4]
    							? click_handler_1
    							: /*customImageClicked*/ ctx[15]).apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(div0, "keydown", /*keydown_handler_1*/ ctx[22], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*disableControl, imageOptions, selectedImage, imageOptionClicked, activateOnKeyboard*/ 28720) {
    				each_value = /*imageOptions*/ ctx[12];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty[0] & /*customImageURL*/ 1024) {
    				toggle_class(span0, "hidden", /*customImageURL*/ ctx[10] === null);
    			}

    			if (!current || dirty[0] & /*disableControl*/ 16 && div0_tabindex_value !== (div0_tabindex_value = /*disableControl*/ ctx[4] ? -1 : 0)) {
    				attr_dev(div0, "tabindex", div0_tabindex_value);
    			}

    			if (!current || dirty[0] & /*disableControl*/ 16) {
    				attr_dev(div0, "aria-disabled", /*disableControl*/ ctx[4]);
    			}

    			if (!current || dirty[0] & /*selectedImage*/ 32) {
    				toggle_class(div0, "inactive", /*selectedImage*/ ctx[5] !== 'custom');
    			}

    			if (!current || dirty[0] & /*disableControl*/ 16) {
    				toggle_class(div0, "disabled", /*disableControl*/ ctx[4]);
    			}

    			if ((!current || dirty[0] & /*hoverInfo*/ 2) && t5_value !== (t5_value = /*hoverInfo*/ ctx[1].text + "")) set_data_dev(t5, t5_value);

    			if (!current || dirty[0] & /*hoverInfo*/ 2) {
    				set_style(button, "opacity", /*hoverInfo*/ ctx[1].show ? 1 : 0);
    			}

    			if (/*modelLoadNotice*/ ctx[2].length > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(div4, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block1) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block1 = if_blocks[current_block_type_index];

    					if (!if_block1) {
    						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block1.c();
    					} else {
    						if_block1.p(ctx, dirty);
    					}

    					transition_in(if_block1, 1);
    					if_block1.m(div5, null);
    				} else {
    					if_block1 = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block1);
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block1);
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_each(each_blocks, detaching);
    			if (if_block0) if_block0.d();
    			/*div4_binding*/ ctx[23](null);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(div5);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			if (detaching) detach_dev(t9);
    			destroy_component(modal, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const headingCanvasTopPadding = 30;

    const click_handler = () => {
    	
    };

    const click_handler_1 = () => {
    	
    };

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Overview', slots, []);
    	let overviewComponent;
    	let scaleLevelSet = new Set(['local', 'module', 'global']);
    	let selectedScaleLevel = 'local';
    	selectedScaleLevelStore.set(selectedScaleLevel);
    	let previousSelectedScaleLevel = selectedScaleLevel;
    	let wholeSvg = undefined;
    	let svg = undefined;

    	// Configs
    	const layerColorScales = overviewConfig.layerColorScales;

    	const nodeLength = overviewConfig.nodeLength;
    	const plusSymbolRadius = overviewConfig.plusSymbolRadius;
    	const edgeOpacity = overviewConfig.edgeOpacity;
    	const edgeInitColor = overviewConfig.edgeInitColor;
    	const edgeHoverColor = overviewConfig.edgeHoverColor;
    	const edgeHoverOuting = overviewConfig.edgeHoverOuting;
    	const edgeStrokeWidth = overviewConfig.edgeStrokeWidth;
    	const intermediateColor = overviewConfig.intermediateColor;
    	const kernelRectLength = overviewConfig.kernelRectLength;
    	const svgPaddings = overviewConfig.svgPaddings;
    	const gapRatio = overviewConfig.gapRatio;
    	const overlayRectOffset = overviewConfig.overlayRectOffset;
    	const classLists = overviewConfig.classLists;

    	// Shared properties
    	let needRedraw = [undefined, undefined];

    	needRedrawStore.subscribe(value => {
    		needRedraw = value;
    	});

    	let nodeCoordinate = undefined;

    	nodeCoordinateStore.subscribe(value => {
    		nodeCoordinate = value;
    	});

    	let cnnLayerRanges = undefined;

    	cnnLayerRangesStore.subscribe(value => {
    		cnnLayerRanges = value;
    	});

    	let cnnLayerMinMax = undefined;

    	cnnLayerMinMaxStore.subscribe(value => {
    		cnnLayerMinMax = value;
    	});

    	let detailedMode = undefined;

    	detailedModeStore.subscribe(value => {
    		detailedMode = value;
    	});

    	let shouldIntermediateAnimate = undefined;

    	shouldIntermediateAnimateStore.subscribe(value => {
    		shouldIntermediateAnimate = value;
    	});

    	let vSpaceAroundGap = undefined;

    	vSpaceAroundGapStore.subscribe(value => {
    		vSpaceAroundGap = value;
    	});

    	let hSpaceAroundGap = undefined;

    	hSpaceAroundGapStore.subscribe(value => {
    		hSpaceAroundGap = value;
    	});

    	let isInSoftmax = undefined;

    	isInSoftmaxStore.subscribe(value => {
    		isInSoftmax = value;
    	});

    	let softmaxDetailViewInfo = undefined;

    	softmaxDetailViewStore.subscribe(value => {
    		softmaxDetailViewInfo = value;
    	});

    	let modalInfo = undefined;

    	modalStore.subscribe(value => {
    		modalInfo = value;
    	});

    	let hoverInfo = undefined;

    	hoverInfoStore.subscribe(value => {
    		$$invalidate(1, hoverInfo = value);
    	});

    	let intermediateLayerPosition = undefined;

    	intermediateLayerPositionStore.subscribe(value => {
    		intermediateLayerPosition = value;
    	});

    	let width = undefined;
    	let height = undefined;
    	let model = undefined;
    	let modelLoadNotice = '';
    	let selectedNode = { layerName: '', index: -1, data: null };
    	let isInIntermediateView = false;
    	let isInActPoolDetailView = false;
    	let actPoolDetailViewNodeIndex = -1;
    	let actPoolDetailViewLayerIndex = -1;
    	let detailedViewNum = undefined;
    	let disableControl = false;

    	// Wait to load
    	let cnn = undefined;

    	let detailedViewAbsCoords = {
    		1: [600, 270, 490, 290],
    		2: [500, 270, 490, 290],
    		3: [700, 270, 490, 290],
    		4: [600, 270, 490, 290],
    		5: [650, 270, 490, 290],
    		6: [775, 270, 490, 290],
    		7: [100, 270, 490, 290],
    		8: [60, 270, 490, 290],
    		9: [200, 270, 490, 290],
    		10: [300, 270, 490, 290]
    	};

    	const layerIndexDict = {
    		'input': 0,
    		'conv_1': 1,
    		'relu_1': 2,
    		'max_pool_1': 3,
    		'conv_2': 4,
    		'relu_2': 5,
    		'max_pool_2': 6,
    		'bottleneck': 7,
    		'unflatten': 8,
    		'upsample_1': 9,
    		'conv_3': 10,
    		'relu_3': 11,
    		'upsample_2': 12,
    		'conv_4': 13,
    		'sigmoid': 14,
    		'output': 15,
    		// Hidden layers used for expansion-only flow
    		'flatten': -1,
    		'fc_layer': -1
    	};

    	const layerLegendDict = {
    		0: {
    			local: 'input-legend',
    			module: 'input-legend',
    			global: 'input-legend'
    		},
    		1: {
    			local: 'local-legend-0-1',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		2: {
    			local: 'local-legend-0-1',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		3: {
    			local: 'local-legend-0-2',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		4: {
    			local: 'local-legend-0-2',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		5: {
    			local: 'local-legend-0-2',
    			module: 'module-legend-0',
    			global: 'global-legend'
    		},
    		6: {
    			local: 'local-legend-1-1',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		7: {
    			local: 'local-legend-1-1',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		8: {
    			local: 'local-legend-1-2',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		9: {
    			local: 'local-legend-1-2',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		10: {
    			local: 'local-legend-1-2',
    			module: 'module-legend-1',
    			global: 'global-legend'
    		},
    		11: {
    			local: 'output-legend',
    			module: 'output-legend',
    			global: 'output-legend'
    		},
    		12: {
    			local: 'output-legend',
    			module: 'output-legend',
    			global: 'output-legend'
    		},
    		13: {
    			local: 'output-legend',
    			module: 'output-legend',
    			global: 'output-legend'
    		},
    		14: {
    			local: 'output-legend',
    			module: 'output-legend',
    			global: 'output-legend'
    		},
    		15: {
    			local: 'output-legend',
    			module: 'output-legend',
    			global: 'output-legend'
    		}
    	};

    	let imageOptions = [
    		{ file: '0_1.png', class: 'digit 0' },
    		{ file: '1_1.png', class: 'digit 1' },
    		{ file: '2_1.png', class: 'digit 2' },
    		{ file: '3_1.png', class: 'digit 3' },
    		{ file: '4_1.png', class: 'digit 4' },
    		{ file: '5_1.png', class: 'digit 5' },
    		{ file: '6_1.png', class: 'digit 6' },
    		{ file: '7_1.png', class: 'digit 7' },
    		{ file: '8_1.png', class: 'digit 8' },
    		{ file: '9_1.png', class: 'digit 9' }
    	];

    	let selectedImage = imageOptions[0].file;
    	let nodeData;
    	let selectedNodeIndex = -1;
    	let isExitedFromDetailedView = true;
    	let isExitedFromCollapse = true;
    	let customImageURL = null;

    	let detailViewAnchor = {
    		mode: 'none',
    		previousLayerIndex: -1,
    		previousNodeIndex: -1,
    		currentLayerIndex: -1,
    		currentNodeIndex: -1,
    		preferRight: true
    	};

    	const getNodeImageRect = (layerIndex, nodeIndex) => {
    		const imageNode = svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('image.node-image').node();
    		return imageNode ? imageNode.getBoundingClientRect() : null;
    	};

    	const getIntermediateImageRect = nodeIndex => {
    		const imageNode = svg.select('g.intermediate-layer').select(`g.intermediate-node[node-index="${nodeIndex}"]`).select('image').node();
    		return imageNode ? imageNode.getBoundingClientRect() : null;
    	};

    	const updateDetailViewPosition = () => {
    		if (detailViewAnchor.mode === 'none') {
    			return;
    		}

    		const detailview = document.getElementById('detailview');

    		if (!detailview) {
    			return;
    		}

    		let previousRect = null;
    		let currentRect = null;

    		if (detailViewAnchor.mode === 'layer-pair') {
    			previousRect = getNodeImageRect(detailViewAnchor.previousLayerIndex, detailViewAnchor.previousNodeIndex);
    			currentRect = getNodeImageRect(detailViewAnchor.currentLayerIndex, detailViewAnchor.currentNodeIndex);
    		} else if (detailViewAnchor.mode === 'conv-pair') {
    			previousRect = getNodeImageRect(detailViewAnchor.previousLayerIndex, detailViewAnchor.previousNodeIndex);
    			currentRect = getIntermediateImageRect(detailViewAnchor.currentNodeIndex);
    		}

    		if (!previousRect || !currentRect) {
    			return;
    		}

    		const margin = 12;
    		const viewportPad = 8;
    		const detailWidth = detailview.offsetWidth || 486;
    		const detailHeight = detailview.offsetHeight || 250;

    		// Keep the detail panel clear of both maps: right of current or left of previous.
    		const rightX = currentRect.right + margin;

    		const leftX = previousRect.left - detailWidth - margin;
    		const canPlaceRight = rightX + detailWidth <= window.innerWidth - viewportPad;
    		const canPlaceLeft = leftX >= viewportPad;
    		let left = rightX;

    		if (detailViewAnchor.preferRight) {
    			if (!canPlaceRight && canPlaceLeft) {
    				left = leftX;
    			}
    		} else if (canPlaceLeft) {
    			left = leftX;
    		} else if (!canPlaceRight && canPlaceLeft) {
    			left = leftX;
    		}

    		const pairMidY = (Math.min(previousRect.top, currentRect.top) + Math.max(previousRect.bottom, currentRect.bottom)) / 2;
    		let top = pairMidY - detailHeight / 2;
    		top = Math.max(viewportPad, Math.min(top, window.innerHeight - detailHeight - viewportPad));
    		left = Math.max(viewportPad, Math.min(left, window.innerWidth - detailWidth - viewportPad));
    		detailview.style.position = 'fixed';
    		detailview.style.left = `${left}px`;
    		detailview.style.top = `${top}px`;
    	};

    	const scheduleDetailViewPosition = () => {
    		requestAnimationFrame(() => requestAnimationFrame(updateDetailViewPosition));
    	};

    	const pinDetailViewToLayerPair = (previousLayerIndex, previousNodeIndex, currentLayerIndex, currentNodeIndex, preferRight) => {
    		detailViewAnchor = {
    			mode: 'layer-pair',
    			previousLayerIndex,
    			previousNodeIndex,
    			currentLayerIndex,
    			currentNodeIndex,
    			preferRight
    		};

    		scheduleDetailViewPosition();
    	};

    	const pinDetailViewToConvPair = (previousLayerIndex, nodeIndex, preferRight) => {
    		detailViewAnchor = {
    			mode: 'conv-pair',
    			previousLayerIndex,
    			previousNodeIndex: nodeIndex,
    			currentLayerIndex: -1,
    			currentNodeIndex: nodeIndex,
    			preferRight
    		};

    		scheduleDetailViewPosition();
    	};

    	const clearDetailViewAnchor = () => {
    		detailViewAnchor = {
    			mode: 'none',
    			previousLayerIndex: -1,
    			previousNodeIndex: -1,
    			currentLayerIndex: -1,
    			currentNodeIndex: -1,
    			preferRight: true
    		};
    	};

    	const activateOnKeyboard = (event, handler) => {
    		if (disableControl) return;

    		if (event.key === 'Enter' || event.key === ' ') {
    			event.preventDefault();
    			handler(event);
    		}
    	};

    	const clampNonNegative = value => Math.max(0, Number(value) || 0);

    	const isAutoencoderModel = loadedModel => {
    		let layerNames = loadedModel.layers.map(layer => layer.name);
    		let hasBottleneck = layerNames.includes('bottleneck');
    		let hasUnflatten = layerNames.includes('unflatten') || layerNames.some(name => name.includes('reshape'));
    		let hasUpsample = layerNames.some(name => name.includes('upsample'));
    		return hasBottleneck && hasUnflatten && hasUpsample;
    	};

    	// Helper functions
    	const selectedScaleLevelChanged = () => {
    		if (svg !== undefined) {
    			if (!scaleLevelSet.add(selectedScaleLevel)) {
    				console.error('Encounter unknown scale level!');
    			}

    			// Update nodes and legends
    			if (selectedScaleLevel != previousSelectedScaleLevel) {
    				// Redraw all non-input, non-output map layers when switching scales.
    				let updatingLayerIndex = cnnLayerRanges[selectedScaleLevel].map((_, idx) => idx).filter(idx => idx > 0 && idx < cnnLayerRanges[selectedScaleLevel].length - 1);

    				updatingLayerIndex.forEach(l => {
    					let range = cnnLayerRanges[selectedScaleLevel][l];
    					svg.select(`#cnn-layer-group-${l}`).selectAll('.node-image').each((d, i, g) => drawOutput(d, i, g, range));
    				});

    				// Hide previous legend
    				svg.selectAll(`.${previousSelectedScaleLevel}-legend`).classed('hidden', true);

    				// Show selected legends
    				svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);
    			}

    			previousSelectedScaleLevel = selectedScaleLevel;
    			selectedScaleLevelStore.set(selectedScaleLevel);
    		}
    	};

    	const intermediateNodeMouseOverHandler = (d, i, g) => {
    		if (detailedViewNum !== undefined) {
    			return;
    		}

    		svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 1);
    	};

    	const intermediateNodeMouseLeaveHandler = (d, i, g) => {
    		// screenshot
    		// return;
    		if (detailedViewNum !== undefined) {
    			return;
    		}

    		svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 0);
    	};

    	const intermediateNodeClicked = (d, i, g, selectedI, curLayerIndex) => {
    		d3.event.stopPropagation();
    		$$invalidate(9, isExitedFromCollapse = false);

    		// Use this event to trigger the detailed view
    		if (detailedViewNum === d.index) {
    			// Setting this for testing purposes currently.
    			$$invalidate(7, selectedNodeIndex = -1);

    			// User clicks this node again -> rewind
    			detailedViewNum = undefined;

    			svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 0);
    		} else // We need to show a new detailed view (two cases: if we need to close the
    		// old detailed view or not)
    		{
    			// Setting this for testing purposes currently.
    			$$invalidate(7, selectedNodeIndex = d.index);

    			let inputMatrix = d.output;
    			let kernelMatrix = d.outputLinks[selectedI].weight;

    			// let interMatrix = singleConv(inputMatrix, kernelMatrix);
    			let colorScale = layerColorScales.conv;

    			// Compute the color range
    			let rangePre = cnnLayerRanges[selectedScaleLevel][curLayerIndex - 1];

    			let rangeCur = cnnLayerRanges[selectedScaleLevel][curLayerIndex];
    			let range = Math.max(rangePre, rangeCur);

    			// User triggers a different detailed view
    			if (detailedViewNum !== undefined) {
    				// Change the underneath highlight
    				svg.select(`rect#underneath-gateway-${detailedViewNum}`).style('opacity', 0);

    				svg.select(`rect#underneath-gateway-${d.index}`).style('opacity', 1);
    			}

    			pinDetailViewToConvPair(curLayerIndex - 1, d.index, curLayerIndex <= 6);
    			detailedViewNum = d.index;

    			// Send the currently used color range to detailed view
    			$$invalidate(6, nodeData.colorRange = range, nodeData);

    			$$invalidate(6, nodeData.inputIsInputLayer = curLayerIndex <= 1, nodeData);
    		}
    	};

    	const animateConv1InPlace = (d, nodeIndex, layerIndex) => {
    		let edge = svg.select(`path#edge-${layerIndex}-${nodeIndex}-0`);

    		if (!edge.empty()) {
    			let edgeNode = edge.node();
    			let edgeLength = edgeNode.getTotalLength();
    			edge.raise().style('stroke', edgeHoverColor).style('stroke-width', 1.2).style('opacity', 1).attr('stroke-dasharray', `${edgeLength} ${edgeLength}`).attr('stroke-dashoffset', edgeLength).transition('conv1-inplace-edge').duration(650).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0).transition('conv1-inplace-edge-restore').duration(450).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
    		}

    		let node = svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`);
    		let imageX = +node.select('image.node-image').attr('x');
    		let imageY = +node.select('image.node-image').attr('y');
    		let overlay = node.select('g.overlay-group.conv1-inplace-overlay');

    		if (!overlay.empty()) {
    			overlay.remove();
    		}

    		let stride = Math.max(1, Math.floor(kernelRectLength * 3));
    		let cellsPerAxis = Math.max(1, Math.floor(nodeLength / stride));
    		overlay = node.append('g').attr('class', 'overlay-group conv1-inplace-overlay').attr('transform', `translate(${imageX}, ${imageY})`);

    		for (let r = 0; r < cellsPerAxis; r++) {
    			for (let c = 0; c < cellsPerAxis; c++) {
    				overlay.append('rect').attr('class', `mask-overlay conv1-mask-${r}-${c}`).attr('x', c * stride).attr('y', r * stride).attr('width', stride).attr('height', stride).style('fill', 'var(--light-gray)').style('stroke', 'var(--light-gray)').style('opacity', 1);
    			}
    		}

    		let tick = 0;
    		let total = cellsPerAxis * cellsPerAxis;

    		const revealOne = () => {
    			if (tick >= total) {
    				overlay.transition('conv1-overlay-fade').duration(220).style('opacity', 0).on('end', () => overlay.remove());
    				return;
    			}

    			let rr = Math.floor(tick / cellsPerAxis);
    			let cc = tick % cellsPerAxis;

    			overlay.select(`rect.conv1-mask-${rr}-${cc}`).transition('conv1-mask-hide').duration(120).style('opacity', 0).on('end', () => {
    				tick += 1;
    				revealOne();
    			});
    		};

    		revealOne();
    	};

    	// The order of the if/else statements in this function is very critical
    	const emptySpaceClicked = () => {
    		// If detail view -> rewind to intermediate view
    		if (detailedViewNum !== undefined) {
    			// Setting this for testing purposes currently.
    			$$invalidate(7, selectedNodeIndex = -1);

    			// User clicks this node again -> rewind
    			svg.select(`rect#underneath-gateway-${detailedViewNum}`).style('opacity', 0);

    			detailedViewNum = undefined;
    		} else // If softmax view -> rewind to flatten layer view
    		if (isInSoftmax) {
    			svg.select('.softmax-symbol').dispatch('click');
    		} else // If intermediate view -> rewind to overview
    		if (isInIntermediateView) {
    			let curLayerIndex = layerIndexDict[selectedNode.layerName];
    			quitIntermediateView(curLayerIndex, selectedNode.domG, selectedNode.domI);
    			d3.select(selectedNode.domG[selectedNode.domI]).dispatch('mouseleave');
    		} else // If pool/act detail view -> rewind to overview
    		if (isInActPoolDetailView) {
    			quitActPoolDetailView();
    		}
    	};

    	const prepareToEnterIntermediateView = (d, g, i, curLayerIndex) => {
    		isInIntermediateView = true;

    		// Hide all legends
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', true);

    		svg.selectAll('.input-legend').classed('hidden', true);
    		svg.selectAll('.output-legend').classed('hidden', true);

    		// Hide the input annotation
    		svg.select('.input-annotation').classed('hidden', true);

    		// Highlight the previous layer and this node
    		svg.select(`g#cnn-layer-group-${curLayerIndex - 1}`).selectAll('rect.bounding').style('stroke-width', 2);

    		d3.select(g[i]).select('rect.bounding').style('stroke-width', 2);

    		// Disable control panel UI
    		// d3.select('#level-select').property('disabled', true);
    		// d3.selectAll('.image-container')
    		//   .style('cursor', 'not-allowed')
    		//   .on('mouseclick', () => {});
    		$$invalidate(4, disableControl = true);

    		// Allow infinite animation loop
    		shouldIntermediateAnimateStore.set(true);

    		// Highlight the labels
    		svg.selectAll(`g#layer-label-${curLayerIndex - 1},
      g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex},
      g#layer-detailed-label-${curLayerIndex}`).style('font-weight', '800');

    		// Register a handler on the svg element so user can click empty space to quit
    		// the intermediate view
    		d3.select('#cnn-svg').on('click', emptySpaceClicked);
    	};

    	const quitActPoolDetailView = () => {
    		clearDetailViewAnchor();
    		isInActPoolDetailView = false;
    		actPoolDetailViewNodeIndex = -1;
    		let layerIndex = layerIndexDict[selectedNode.layerName];
    		let nodeIndex = selectedNode.index;
    		svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);

    		selectedNode.data.inputLinks.forEach(link => {
    			let layerIndex = layerIndexDict[link.source.layerName];
    			let nodeIndex = link.source.index;
    			svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);
    		});

    		// Clean up the underneath rects
    		svg.select('g.underneath').selectAll('rect').remove();

    		// Show all edges
    		let unimportantEdges = svg.select('g.edge-group').selectAll('.edge').filter(d => {
    			return d.targetLayerIndex !== actPoolDetailViewLayerIndex;
    		}).style('visibility', null);

    		// Recover control UI
    		$$invalidate(4, disableControl = false);

    		// Show legends if in detailed mode
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);

    		svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    		svg.selectAll('.output-legend').classed('hidden', !detailedMode);

    		// Also dehighlight the edge
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');

    		edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);

    		// Remove the overlay rect
    		svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').transition('remove').duration(500).ease(d3.easeCubicInOut).style('opacity', 0).on('end', (d, i, g) => {
    			svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').remove();
    			svg.selectAll('defs.overlay-gradient').remove();
    			svg.select('.input-annotation').classed('hidden', false);
    		});

    		// Turn the fade out nodes back
    		svg.select(`g#cnn-layer-group-${layerIndex}`).selectAll('g.node-group').each((sd, si, sg) => {
    			d3.select(sg[si]).style('pointer-events', 'all');
    		});

    		svg.select(`g#cnn-layer-group-${layerIndex - 1}`).selectAll('g.node-group').each((sd, si, sg) => {
    			// Recover the old events
    			d3.select(sg[si]).style('pointer-events', 'all').on('mouseover', nodeMouseOverHandler).on('mouseleave', nodeMouseLeaveHandler).on('click', nodeClickHandler);
    		});

    		// Deselect the node
    		$$invalidate(3, selectedNode.layerName = '', selectedNode);

    		$$invalidate(3, selectedNode.index = -1, selectedNode);
    		$$invalidate(3, selectedNode.data = null, selectedNode);
    		actPoolDetailViewLayerIndex = -1;
    	};

    	const actPoolDetailViewPreNodeMouseOverHandler = (d, i, g) => {
    		// Highlight the edges
    		let layerIndex = layerIndexDict[d.layerName];

    		let nodeIndex = d.index;
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    		edgeGroup.selectAll(`path.edge-${actPoolDetailViewLayerIndex}-${nodeIndex}`).raise().transition().ease(d3.easeCubicInOut).duration(400).style('stroke', edgeHoverColor).style('stroke-width', '1').style('opacity', 1);

    		// Highlight its border
    		d3.select(g[i]).select('rect.bounding').classed('hidden', false);

    		// Highlight node's pair
    		let associatedLayerIndex = layerIndex - 1;

    		if (layerIndex === actPoolDetailViewLayerIndex - 1) {
    			associatedLayerIndex = layerIndex + 1;
    		}

    		svg.select(`g#layer-${associatedLayerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);
    	};

    	const actPoolDetailViewPreNodeMouseLeaveHandler = (d, i, g) => {
    		// De-highlight the edges
    		let layerIndex = layerIndexDict[d.layerName];

    		let nodeIndex = d.index;
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    		edgeGroup.selectAll(`path.edge-${actPoolDetailViewLayerIndex}-${nodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);

    		// De-highlight its border
    		d3.select(g[i]).select('rect.bounding').classed('hidden', true);

    		// De-highlight node's pair
    		let associatedLayerIndex = layerIndex - 1;

    		if (layerIndex === actPoolDetailViewLayerIndex - 1) {
    			associatedLayerIndex = layerIndex + 1;
    		}

    		svg.select(`g#layer-${associatedLayerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);
    	};

    	const actPoolDetailViewPreNodeClickHandler = (d, i, g) => {
    		let layerIndex = layerIndexDict[d.layerName];
    		let nodeIndex = d.index;

    		// Click the pre-layer node in detail view has the same effect as clicking
    		// the cur-layer node, which is to open a new detail view window
    		svg.select(`g#layer-${layerIndex + 1}-node-${nodeIndex}`).node().dispatchEvent(new Event('click'));
    	};

    	const enterDetailView = (curLayerIndex, i) => {
    		pinDetailViewToLayerPair(curLayerIndex - 1, i, curLayerIndex, i, curLayerIndex <= 6);
    		isInActPoolDetailView = true;
    		actPoolDetailViewNodeIndex = i;
    		actPoolDetailViewLayerIndex = curLayerIndex;

    		// Hide all edges
    		let unimportantEdges = svg.select('g.edge-group').selectAll('.edge').filter(d => {
    			return d.targetLayerIndex !== curLayerIndex;
    		}).style('visibility', 'hidden');

    		// Disable UI
    		$$invalidate(4, disableControl = true);

    		// Hide input annotaitons
    		svg.select('.input-annotation').classed('hidden', true);

    		// Hide legends
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', true);

    		svg.selectAll('.input-legend').classed('hidden', true);
    		svg.selectAll('.output-legend').classed('hidden', true);
    		let legendInfo = layerLegendDict[curLayerIndex] || layerLegendDict[15];
    		svg.select(`#${legendInfo[selectedScaleLevel]}`).classed('hidden', false);

    		// Add overlay rects
    		let leftX = nodeCoordinate[curLayerIndex - 1][i].x;

    		// +5 to cover the detailed mode long label
    		let rightStart = nodeCoordinate[curLayerIndex][i].x + nodeLength + 5;

    		// Compute the left and right overlay rect width
    		let rightWidth = width - rightStart - overlayRectOffset / 2;

    		let leftWidth = leftX - nodeCoordinate[0][0].x;
    		rightWidth = clampNonNegative(rightWidth);
    		leftWidth = clampNonNegative(leftWidth);

    		// The overlay rects should be symmetric
    		if (rightWidth > leftWidth) {
    			let stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				},
    				{
    					offset: '50%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.9
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 1
    				}
    			];

    			addOverlayGradient('overlay-gradient-right', stops);
    			let leftEndOpacity = 0.85 + (0.95 - 0.85) * (leftWidth / rightWidth);

    			stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: leftEndOpacity
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				}
    			];

    			addOverlayGradient('overlay-gradient-left', stops);
    		} else {
    			let stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 1
    				},
    				{
    					offset: '50%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.9
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				}
    			];

    			addOverlayGradient('overlay-gradient-left', stops);
    			let rightEndOpacity = 0.85 + (0.95 - 0.85) * (rightWidth / leftWidth);

    			stops = [
    				{
    					offset: '0%',
    					color: 'rgb(250, 250, 250)',
    					opacity: 0.85
    				},
    				{
    					offset: '100%',
    					color: 'rgb(250, 250, 250)',
    					opacity: rightEndOpacity
    				}
    			];

    			addOverlayGradient('overlay-gradient-right', stops);
    		}

    		addOverlayRect('overlay-gradient-right', rightStart + overlayRectOffset / 2 + 0.5, 0, clampNonNegative(rightWidth), height + svgPaddings.top);
    		addOverlayRect('overlay-gradient-left', nodeCoordinate[0][0].x - overlayRectOffset / 2, 0, clampNonNegative(leftWidth), height + svgPaddings.top);
    		svg.selectAll('rect.overlay').on('click', emptySpaceClicked);

    		// Add underneath rectangles
    		let underGroup = svg.select('g.underneath');

    		let padding = 7;

    		for (let n = 0; n < cnn[curLayerIndex - 1].length; n++) {
    			underGroup.append('rect').attr('class', 'underneath-gateway').attr('id', `underneath-gateway-${n}`).attr('x', nodeCoordinate[curLayerIndex - 1][n].x - padding).attr('y', nodeCoordinate[curLayerIndex - 1][n].y - padding).attr('width', 2 * nodeLength + hSpaceAroundGap + 2 * padding).attr('height', nodeLength + 2 * padding).attr('rx', 10).style('fill', 'rgba(160, 160, 160, 0.3)').style('opacity', 0);

    			// Update the event functions for these two layers
    			svg.select(`g#layer-${curLayerIndex - 1}-node-${n}`).style('pointer-events', 'all').style('cursor', 'pointer').on('mouseover', actPoolDetailViewPreNodeMouseOverHandler).on('mouseleave', actPoolDetailViewPreNodeMouseLeaveHandler).on('click', actPoolDetailViewPreNodeClickHandler);
    		}

    		underGroup.lower();

    		// Highlight the selcted pair
    		underGroup.select(`#underneath-gateway-${i}`).style('opacity', 1);
    	};

    	const quitIntermediateView = (curLayerIndex, g, i) => {
    		clearDetailViewAnchor();

    		// If it is the softmax detail view, quit that view first
    		if (isInSoftmax) {
    			svg.select('.logit-layer').remove();
    			svg.select('.logit-layer-lower').remove();
    			svg.selectAll('.plus-symbol-clone').remove();

    			// Instead of removing the paths, we hide them, so it is faster to load in
    			// the future
    			svg.select('.underneath').selectAll('.logit-lower').style('opacity', 0);

    			softmaxDetailViewStore.set({ show: false, logits: [] });
    			allowsSoftmaxAnimationStore.set(false);
    		}

    		isInSoftmaxStore.set(false);
    		isInIntermediateView = false;

    		// Show the legend
    		svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);

    		svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    		svg.selectAll('.output-legend').classed('hidden', !detailedMode);

    		// Recover control panel UI
    		$$invalidate(4, disableControl = false);

    		// Recover the input layer node's event
    		for (let n = 0; n < cnn[curLayerIndex - 1].length; n++) {
    			svg.select(`g#layer-${curLayerIndex - 1}-node-${n}`).on('mouseover', nodeMouseOverHandler).on('mouseleave', nodeMouseLeaveHandler).on('click', nodeClickHandler);
    		}

    		// Clean up the underneath rects
    		svg.select('g.underneath').selectAll('rect').remove();

    		detailedViewNum = undefined;

    		// Highlight the previous layer and this node
    		svg.select(`g#cnn-layer-group-${curLayerIndex - 1}`).selectAll('rect.bounding').style('stroke-width', 1);

    		d3.select(g[i]).select('rect.bounding').style('stroke-width', 1);

    		// Highlight the labels
    		svg.selectAll(`g#layer-label-${curLayerIndex - 1},
      g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex},
      g#layer-detailed-label-${curLayerIndex}`).style('font-weight', 'normal');

    		// Also unclick the node
    		// Record the current clicked node
    		$$invalidate(3, selectedNode.layerName = '', selectedNode);

    		$$invalidate(3, selectedNode.index = -1, selectedNode);
    		$$invalidate(3, selectedNode.data = null, selectedNode);
    		$$invalidate(9, isExitedFromCollapse = true);

    		// Remove the intermediate layer
    		let intermediateLayer = svg.select('g.intermediate-layer');

    		// Kill the infinite animation loop
    		shouldIntermediateAnimateStore.set(false);

    		intermediateLayer.transition('remove').duration(500).ease(d3.easeCubicInOut).style('opacity', 0).on('end', (d, i, g) => {
    			d3.select(g[i]).remove();
    		});

    		// Remove the output node overlay mask
    		svg.selectAll('.overlay-group').remove();

    		// Remove the overlay rect
    		svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').transition('remove').duration(500).ease(d3.easeCubicInOut).style('opacity', 0).on('end', (d, i, g) => {
    			svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').remove();
    			svg.selectAll('defs.overlay-gradient').remove();
    		});

    		// Recover the layer if we have drdrawn it
    		if (needRedraw[0] !== undefined) {
    			let redrawRange = cnnLayerRanges[selectedScaleLevel][needRedraw[0]];

    			if (needRedraw[1] !== undefined) {
    				svg.select(`g#layer-${needRedraw[0]}-node-${needRedraw[1]}`).select('image.node-image').each((d, i, g) => drawOutput(d, i, g, redrawRange));
    			} else {
    				svg.select(`g#cnn-layer-group-${needRedraw[0]}`).selectAll('image.node-image').each((d, i, g) => drawOutput(d, i, g, redrawRange));
    			}
    		}

    		// Move all layers to their original place
    		let layerCount = Math.min(cnn.length, nodeCoordinate.length);

    		for (let i = 0; i < layerCount; i++) {
    			if (!nodeCoordinate[i] || !nodeCoordinate[i][0]) {
    				continue;
    			}

    			moveLayerX({
    				layerIndex: i,
    				targetX: nodeCoordinate[i][0].x,
    				disable: false,
    				delay: 500,
    				opacity: 1
    			});

    			svg.selectAll(`g#layer-label-${i}, g#layer-detailed-label-${i}`).style('opacity', null);
    		}

    		let anchorLayerIndex = Math.max(0, layerCount - 2);

    		if (!nodeCoordinate[anchorLayerIndex] || !nodeCoordinate[anchorLayerIndex][0]) {
    			anchorLayerIndex = Math.max(0, layerCount - 1);
    		}

    		if (nodeCoordinate[anchorLayerIndex] && nodeCoordinate[anchorLayerIndex][0]) {
    			moveLayerX({
    				layerIndex: anchorLayerIndex,
    				targetX: nodeCoordinate[anchorLayerIndex][0].x,
    				opacity: 1,
    				disable: false,
    				delay: 500,
    				onEndFunc: () => {
    					// Show all edges on the last moving animation end
    					svg.select('g.edge-group').style('visibility', 'visible');

    					// Recover the input annotation
    					svg.select('.input-annotation').classed('hidden', false);
    				}
    			});
    		}
    	};

    	const nodeClickHandler = (d, i, g) => {
    		d3.event.stopPropagation();
    		let nodeIndex = d.index;

    		// Record the current clicked node
    		$$invalidate(3, selectedNode.layerName = d.layerName, selectedNode);

    		$$invalidate(3, selectedNode.index = d.index, selectedNode);
    		$$invalidate(3, selectedNode.data = d, selectedNode);
    		$$invalidate(3, selectedNode.domI = i, selectedNode);
    		$$invalidate(3, selectedNode.domG = g, selectedNode);

    		// Record data for detailed view.
    		if (d.type === 'conv' || d.type === 'relu' || d.type === 'pool' || d.type === 'sigmoid' || d.type === 'upsample') {
    			let data = [];

    			for (let j = 0; j < d.inputLinks.length; j++) {
    				data.push({
    					input: d.inputLinks[j].source.output,
    					kernel: d.inputLinks[j].weight,
    					output: d.inputLinks[j].dest.output
    				});
    			}

    			let curLayerIndex = layerIndexDict[d.layerName];
    			data.colorRange = cnnLayerRanges[selectedScaleLevel][curLayerIndex];
    			data.isInputInputLayer = curLayerIndex <= 1;
    			$$invalidate(6, nodeData = data);
    		}

    		let curLayerIndex = layerIndexDict[d.layerName];

    		if (d.type == 'relu' || d.type == 'pool' || d.type == 'sigmoid' || d.type == 'upsample') {
    			$$invalidate(8, isExitedFromDetailedView = false);

    			if (!isInActPoolDetailView) {
    				// Enter the act pool detail view
    				enterDetailView(curLayerIndex, d.index);
    			} else {
    				if (d.index === actPoolDetailViewNodeIndex) {
    					// Quit the act pool detail view
    					quitActPoolDetailView();
    				} else {
    					// Switch the detail view input to the new clicked pair
    					// Remove the previous selection effect
    					svg.select(`g#layer-${curLayerIndex}-node-${actPoolDetailViewNodeIndex}`).select('rect.bounding').classed('hidden', true);

    					svg.select(`g#layer-${curLayerIndex - 1}-node-${actPoolDetailViewNodeIndex}`).select('rect.bounding').classed('hidden', true);
    					let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    					edgeGroup.selectAll(`path.edge-${curLayerIndex}-${actPoolDetailViewNodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);
    					let underGroup = svg.select('g.underneath');
    					underGroup.select(`#underneath-gateway-${actPoolDetailViewNodeIndex}`).style('opacity', 0);

    					// Add selection effect on the new selected pair
    					svg.select(`g#layer-${curLayerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);

    					svg.select(`g#layer-${curLayerIndex - 1}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);
    					edgeGroup.selectAll(`path.edge-${curLayerIndex}-${nodeIndex}`).raise().transition().ease(d3.easeCubicInOut).duration(400).style('stroke', edgeHoverColor).style('stroke-width', '1').style('opacity', 1);
    					underGroup.select(`#underneath-gateway-${nodeIndex}`).style('opacity', 1);
    					actPoolDetailViewNodeIndex = nodeIndex;
    				}
    			}
    		}

    		if (d.layerName === 'conv_1') {
    			animateConv1InPlace(d, nodeIndex, curLayerIndex);
    			return;
    		}

    		// Enter the second view (layer-view) when user clicks a conv node
    		if ((d.type === 'conv' || d.layerName === 'bottleneck' || d.layerName === 'unflatten') && !isInIntermediateView) {
    			prepareToEnterIntermediateView(d, g, nodeIndex, curLayerIndex);

    			if (d.layerName === 'conv_2') {
    				drawConv2(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'conv_3') {
    				drawConv3(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'conv_4') {
    				drawConv4(curLayerIndex, d, nodeIndex, width, height, intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler, intermediateNodeClicked);
    			} else if (d.layerName === 'bottleneck') {
    				drawFlatten(curLayerIndex, d, nodeIndex, width, height);
    			} else if (d.layerName === 'unflatten') {
    				drawFcToUnflatten(d, nodeIndex, width, height);
    			}
    		} else // Quit the layerview
    		if ((d.type === 'conv' || d.layerName === 'bottleneck' || d.layerName === 'unflatten') && isInIntermediateView) {
    			quitIntermediateView(curLayerIndex, g, i);
    		}
    	};

    	const nodeMouseOverHandler = (d, i, g) => {
    		// if (isInIntermediateView || isInActPoolDetailView) { return; }
    		if (isInIntermediateView) {
    			return;
    		}

    		// Highlight the edges
    		let layerIndex = layerIndexDict[d.layerName];

    		let nodeIndex = d.index;
    		let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    		edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`).raise().transition().ease(d3.easeCubicInOut).duration(400).style('stroke', edgeHoverColor).style('stroke-width', '1').style('opacity', 1);

    		// Highlight its border
    		d3.select(g[i]).select('rect.bounding').classed('hidden', false);

    		// Highlight source's border
    		if (d.inputLinks.length === 1) {
    			let link = d.inputLinks[0];
    			let layerIndex = layerIndexDict[link.source.layerName];
    			let nodeIndex = link.source.index;
    			svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', false);
    		} else {
    			svg.select(`g#cnn-layer-group-${layerIndex - 1}`).selectAll('g.node-group').selectAll('rect.bounding').classed('hidden', false);
    		}

    		// Highlight the output text
    		if (d.layerName === 'bottleneck') {
    			d3.select(g[i]).select('.output-text').style('opacity', 0.8).style('text-decoration', 'underline');
    		}
    	}; /* Use the following commented code if we have non-linear model
    d.inputLinks.forEach(link => {
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', false);
    });
    */

    	const nodeMouseLeaveHandler = (d, i, g) => {
    		// Screenshot
    		// return;
    		if (isInIntermediateView) {
    			return;
    		}

    		// Keep the highlight if user has clicked
    		if (isInActPoolDetailView || (d.layerName !== selectedNode.layerName || d.index !== selectedNode.index)) {
    			let layerIndex = layerIndexDict[d.layerName];
    			let nodeIndex = d.index;
    			let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    			edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`).transition().ease(d3.easeCubicOut).duration(200).style('stroke', edgeInitColor).style('stroke-width', edgeStrokeWidth).style('opacity', edgeOpacity);
    			d3.select(g[i]).select('rect.bounding').classed('hidden', true);

    			if (d.inputLinks.length === 1) {
    				let link = d.inputLinks[0];
    				let layerIndex = layerIndexDict[link.source.layerName];
    				let nodeIndex = link.source.index;
    				svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('rect.bounding').classed('hidden', true);
    			} else {
    				svg.select(`g#cnn-layer-group-${layerIndex - 1}`).selectAll('g.node-group').selectAll('rect.bounding').classed('hidden', d => d.layerName !== selectedNode.layerName || d.index !== selectedNode.index);
    			}

    			// Dehighlight the output text
    			if (d.layerName === 'bottleneck') {
    				d3.select(g[i]).select('.output-text').style('fill', 'black').style('opacity', 0.5).style('text-decoration', 'none');
    			}
    		} /* Use the following commented code if we have non-linear model
    d.inputLinks.forEach(link => {
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', true);
    });
    */
    	};

    	let logits = [-4.28, 2.96, -0.38, 5.24, -7.56, -3.43, 8.63, 2.63, 6.30, 0.68];
    	let selectedI = 4;

    	onMount(async () => {
    		const handleViewportChange = () => updateDetailViewPosition();
    		window.addEventListener('scroll', handleViewportChange, true);
    		window.addEventListener('resize', handleViewportChange);

    		// Create SVG
    		wholeSvg = d3.select(overviewComponent).select('#cnn-svg');

    		svg = wholeSvg.append('g').attr('class', 'main-svg').attr('transform', `translate(${svgPaddings.left}, ${headingCanvasTopPadding})`);
    		svgStore.set(svg);
    		width = Number(wholeSvg.style('width').replace('px', '')) - svgPaddings.left - svgPaddings.right;
    		height = Number(wholeSvg.style('height').replace('px', '')) - svgPaddings.top - svgPaddings.bottom - headingCanvasTopPadding;
    		let cnnGroup = svg.append('g').attr('class', 'cnn-group');
    		let underGroup = svg.append('g').attr('class', 'underneath');
    		let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;

    		detailedViewAbsCoords = {
    			1: [600, 100 + svgYMid - 220 / 2, 490, 290],
    			2: [500, 100 + svgYMid - 220 / 2, 490, 290],
    			3: [700, 100 + svgYMid - 220 / 2, 490, 290],
    			4: [600, 100 + svgYMid - 220 / 2, 490, 290],
    			5: [650, 100 + svgYMid - 220 / 2, 490, 290],
    			6: [850, 100 + svgYMid - 220 / 2, 490, 290],
    			7: [100, 100 + svgYMid - 220 / 2, 490, 290],
    			8: [60, 100 + svgYMid - 220 / 2, 490, 290],
    			9: [200, 100 + svgYMid - 220 / 2, 490, 290],
    			10: [300, 100 + svgYMid - 220 / 2, 490, 290]
    		};

    		// Define global arrow marker end
    		svg.append("defs").append("marker").attr("id", 'marker').attr("viewBox", "0 -5 10 10").attr("refX", 6).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").style('stroke-width', 1.2).style('fill', 'gray').style('stroke', 'gray').attr("d", "M0,-5L10,0L0,5");

    		// Alternative arrow head style for non-interactive annotation
    		svg.append("defs").append("marker").attr("id", 'marker-alt').attr("viewBox", "0 -5 10 10").attr("refX", 6).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").style('fill', 'none').style('stroke', 'gray').style('stroke-width', 2).attr("d", "M-5,-10L10,0L-5,10");

    		console.time('Construct cnn');

    		try {
    			model = await loadTrainedModel('/assets/data/autoencoder-model.json');

    			if (!isAutoencoderModel(model)) {
    				throw new Error('autoencoder-model.json is present but is not a CAE architecture.');
    			}
    		} catch(error) {
    			$$invalidate(2, modelLoadNotice = 'Failed to load trained CAE artifacts from assets/data/autoencoder-model.json. ' + 'Train and export the model from tiny-vgg/train_cae_mnist.py.');
    			console.warn(modelLoadNotice, error);
    			return;
    		}

    		cnn = await constructCNN(`/assets/img/${selectedImage}`, model);
    		console.timeEnd('Construct cnn');

    		// Hide flatten/fc_layer in the overview, but keep them for expansion views.
    		let flattenIndex = cnn.findIndex(layer => layer[0].layerName === 'flatten');

    		if (flattenIndex !== -1) {
    			cnn.flatten = cnn[flattenIndex];
    			cnn.splice(flattenIndex, 1);
    		}

    		let fcLayerIndex = cnn.findIndex(layer => layer[0].layerName === 'fc_layer');

    		if (fcLayerIndex !== -1) {
    			cnn.fc_layer = cnn[fcLayerIndex];
    			cnn.splice(fcLayerIndex, 1);
    		}

    		cnnStore.set(cnn);
    		console.log(cnn);
    		updateCNNLayerRanges();

    		// Create and draw the CNN view
    		drawCNN(width, height, cnnGroup, nodeMouseOverHandler, nodeMouseLeaveHandler, nodeClickHandler);

    		return () => {
    			window.removeEventListener('scroll', handleViewportChange, true);
    			window.removeEventListener('resize', handleViewportChange);
    		};
    	});

    	const detailedButtonClicked = () => {
    		detailedMode = !detailedMode;
    		detailedModeStore.set(detailedMode);

    		if (!isInIntermediateView) {
    			// Show the legend
    			svg.selectAll(`.${selectedScaleLevel}-legend`).classed('hidden', !detailedMode);

    			svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    			svg.selectAll('.output-legend').classed('hidden', !detailedMode);
    		}

    		// Switch the layer name
    		svg.selectAll('.layer-detailed-label').classed('hidden', !detailedMode);

    		svg.selectAll('.layer-label').classed('hidden', detailedMode);
    	};

    	const imageOptionClicked = async e => {
    		if (!model) {
    			return;
    		}

    		let newImageName = d3.select(e.target).attr('data-imageName');

    		if (newImageName !== selectedImage) {
    			$$invalidate(5, selectedImage = newImageName);

    			// Re-compute the CNN using the new input image
    			cnn = await constructCNN(`/assets/img/${selectedImage}`, model);

    			let flattenIndex = cnn.findIndex(layer => layer[0].layerName === 'flatten');

    			if (flattenIndex !== -1) {
    				cnn.flatten = cnn[flattenIndex];
    				cnn.splice(flattenIndex, 1);
    			}

    			let fcLayerIndex = cnn.findIndex(layer => layer[0].layerName === 'fc_layer');

    			if (fcLayerIndex !== -1) {
    				cnn.fc_layer = cnn[fcLayerIndex];
    				cnn.splice(fcLayerIndex, 1);
    			}

    			cnnStore.set(cnn);

    			// Update all scales used in the CNN view
    			updateCNNLayerRanges();

    			updateCNN();
    		}
    	};

    	const customImageClicked = () => {
    		// Case 1: there is no custom image -> show the modal to get user input
    		if (customImageURL === null) {
    			modalInfo.show = true;
    			modalInfo.preImage = selectedImage;
    			modalStore.set(modalInfo);
    		} else // Case 2: there is an existing custom image, not the focus -> switch to this image
    		if (selectedImage !== 'custom') {
    			let fakeEvent = { detail: { url: customImageURL } };
    			handleCustomImage(fakeEvent);
    		} else // Case 3: there is an existing custom image, and its the focus -> let user
    		// upload a new image
    		{
    			modalInfo.show = true;
    			modalInfo.preImage = selectedImage;
    			modalStore.set(modalInfo);
    		}

    		if (selectedImage !== 'custom') {
    			$$invalidate(5, selectedImage = 'custom');
    		}
    	};

    	const handleModalCanceled = event => {
    		// User cancels the modal without a successful image, so we restore the
    		// previous selected image as input
    		$$invalidate(5, selectedImage = event.detail.preImage);
    	};

    	const handleCustomImage = async event => {
    		if (!model) {
    			return;
    		}

    		// User gives a valid image URL
    		$$invalidate(10, customImageURL = event.detail.url);

    		// Re-compute the CNN using the new input image
    		cnn = await constructCNN(customImageURL, model);

    		let flattenIndex = cnn.findIndex(layer => layer[0].layerName === 'flatten');

    		if (flattenIndex !== -1) {
    			cnn.flatten = cnn[flattenIndex];
    			cnn.splice(flattenIndex, 1);
    		}

    		let fcLayerIndex = cnn.findIndex(layer => layer[0].layerName === 'fc_layer');

    		if (fcLayerIndex !== -1) {
    			cnn.fc_layer = cnn[fcLayerIndex];
    			cnn.splice(fcLayerIndex, 1);
    		}

    		cnnStore.set(cnn);

    		// Update the UI
    		let customImageSlot = d3.select(overviewComponent).select('.custom-image').node();

    		drawCustomImage(customImageSlot, cnn[0]);

    		// Update all scales used in the CNN view
    		updateCNNLayerRanges();

    		updateCNN();
    	};

    	function handleExitFromDetiledConvView(event) {
    		if (event.detail.text) {
    			clearDetailViewAnchor();
    			detailedViewNum = undefined;
    			svg.select(`rect#underneath-gateway-${selectedNodeIndex}`).style('opacity', 0);
    			$$invalidate(7, selectedNodeIndex = -1);
    		}
    	}

    	function handleExitFromDetiledPoolView(event) {
    		if (event.detail.text) {
    			quitActPoolDetailView();
    			$$invalidate(8, isExitedFromDetailedView = true);
    		}
    	}

    	function handleExitFromDetiledActivationView(event) {
    		if (event.detail.text) {
    			quitActPoolDetailView();
    			$$invalidate(8, isExitedFromDetailedView = true);
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = event => activateOnKeyboard(event, imageOptionClicked);
    	const keydown_handler_1 = event => activateOnKeyboard(event, customImageClicked);

    	function div4_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			overviewComponent = $$value;
    			$$invalidate(0, overviewComponent);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		cnnStore,
    		svgStore,
    		vSpaceAroundGapStore,
    		hSpaceAroundGapStore,
    		nodeCoordinateStore,
    		selectedScaleLevelStore,
    		cnnLayerRangesStore,
    		needRedrawStore,
    		cnnLayerMinMaxStore,
    		detailedModeStore,
    		shouldIntermediateAnimateStore,
    		isInSoftmaxStore,
    		softmaxDetailViewStore,
    		hoverInfoStore,
    		allowsSoftmaxAnimationStore,
    		modalStore,
    		intermediateLayerPositionStore,
    		ConvolutionView: Convolutionview,
    		ActivationView: Activationview,
    		PoolView: Poolview,
    		UpsampleView: Upsampleview,
    		Modal,
    		loadTrainedModel,
    		constructCNN,
    		overviewConfig,
    		addOverlayRect,
    		drawConv1,
    		drawConv2,
    		drawConv3,
    		drawConv4,
    		moveLayerX,
    		addOverlayGradient,
    		drawFlatten,
    		drawFcToUnflatten,
    		drawOutput,
    		drawCNN,
    		updateCNN,
    		updateCNNLayerRanges,
    		drawCustomImage,
    		overviewComponent,
    		scaleLevelSet,
    		selectedScaleLevel,
    		previousSelectedScaleLevel,
    		wholeSvg,
    		svg,
    		layerColorScales,
    		nodeLength,
    		plusSymbolRadius,
    		edgeOpacity,
    		edgeInitColor,
    		edgeHoverColor,
    		edgeHoverOuting,
    		edgeStrokeWidth,
    		intermediateColor,
    		kernelRectLength,
    		svgPaddings,
    		gapRatio,
    		overlayRectOffset,
    		classLists,
    		headingCanvasTopPadding,
    		needRedraw,
    		nodeCoordinate,
    		cnnLayerRanges,
    		cnnLayerMinMax,
    		detailedMode,
    		shouldIntermediateAnimate,
    		vSpaceAroundGap,
    		hSpaceAroundGap,
    		isInSoftmax,
    		softmaxDetailViewInfo,
    		modalInfo,
    		hoverInfo,
    		intermediateLayerPosition,
    		width,
    		height,
    		model,
    		modelLoadNotice,
    		selectedNode,
    		isInIntermediateView,
    		isInActPoolDetailView,
    		actPoolDetailViewNodeIndex,
    		actPoolDetailViewLayerIndex,
    		detailedViewNum,
    		disableControl,
    		cnn,
    		detailedViewAbsCoords,
    		layerIndexDict,
    		layerLegendDict,
    		imageOptions,
    		selectedImage,
    		nodeData,
    		selectedNodeIndex,
    		isExitedFromDetailedView,
    		isExitedFromCollapse,
    		customImageURL,
    		detailViewAnchor,
    		getNodeImageRect,
    		getIntermediateImageRect,
    		updateDetailViewPosition,
    		scheduleDetailViewPosition,
    		pinDetailViewToLayerPair,
    		pinDetailViewToConvPair,
    		clearDetailViewAnchor,
    		activateOnKeyboard,
    		clampNonNegative,
    		isAutoencoderModel,
    		selectedScaleLevelChanged,
    		intermediateNodeMouseOverHandler,
    		intermediateNodeMouseLeaveHandler,
    		intermediateNodeClicked,
    		animateConv1InPlace,
    		emptySpaceClicked,
    		prepareToEnterIntermediateView,
    		quitActPoolDetailView,
    		actPoolDetailViewPreNodeMouseOverHandler,
    		actPoolDetailViewPreNodeMouseLeaveHandler,
    		actPoolDetailViewPreNodeClickHandler,
    		enterDetailView,
    		quitIntermediateView,
    		nodeClickHandler,
    		nodeMouseOverHandler,
    		nodeMouseLeaveHandler,
    		logits,
    		selectedI,
    		detailedButtonClicked,
    		imageOptionClicked,
    		customImageClicked,
    		handleModalCanceled,
    		handleCustomImage,
    		handleExitFromDetiledConvView,
    		handleExitFromDetiledPoolView,
    		handleExitFromDetiledActivationView
    	});

    	$$self.$inject_state = $$props => {
    		if ('overviewComponent' in $$props) $$invalidate(0, overviewComponent = $$props.overviewComponent);
    		if ('scaleLevelSet' in $$props) scaleLevelSet = $$props.scaleLevelSet;
    		if ('selectedScaleLevel' in $$props) $$invalidate(51, selectedScaleLevel = $$props.selectedScaleLevel);
    		if ('previousSelectedScaleLevel' in $$props) previousSelectedScaleLevel = $$props.previousSelectedScaleLevel;
    		if ('wholeSvg' in $$props) wholeSvg = $$props.wholeSvg;
    		if ('svg' in $$props) svg = $$props.svg;
    		if ('needRedraw' in $$props) needRedraw = $$props.needRedraw;
    		if ('nodeCoordinate' in $$props) nodeCoordinate = $$props.nodeCoordinate;
    		if ('cnnLayerRanges' in $$props) cnnLayerRanges = $$props.cnnLayerRanges;
    		if ('cnnLayerMinMax' in $$props) cnnLayerMinMax = $$props.cnnLayerMinMax;
    		if ('detailedMode' in $$props) detailedMode = $$props.detailedMode;
    		if ('shouldIntermediateAnimate' in $$props) shouldIntermediateAnimate = $$props.shouldIntermediateAnimate;
    		if ('vSpaceAroundGap' in $$props) vSpaceAroundGap = $$props.vSpaceAroundGap;
    		if ('hSpaceAroundGap' in $$props) hSpaceAroundGap = $$props.hSpaceAroundGap;
    		if ('isInSoftmax' in $$props) isInSoftmax = $$props.isInSoftmax;
    		if ('softmaxDetailViewInfo' in $$props) softmaxDetailViewInfo = $$props.softmaxDetailViewInfo;
    		if ('modalInfo' in $$props) modalInfo = $$props.modalInfo;
    		if ('hoverInfo' in $$props) $$invalidate(1, hoverInfo = $$props.hoverInfo);
    		if ('intermediateLayerPosition' in $$props) intermediateLayerPosition = $$props.intermediateLayerPosition;
    		if ('width' in $$props) width = $$props.width;
    		if ('height' in $$props) height = $$props.height;
    		if ('model' in $$props) model = $$props.model;
    		if ('modelLoadNotice' in $$props) $$invalidate(2, modelLoadNotice = $$props.modelLoadNotice);
    		if ('selectedNode' in $$props) $$invalidate(3, selectedNode = $$props.selectedNode);
    		if ('isInIntermediateView' in $$props) isInIntermediateView = $$props.isInIntermediateView;
    		if ('isInActPoolDetailView' in $$props) isInActPoolDetailView = $$props.isInActPoolDetailView;
    		if ('actPoolDetailViewNodeIndex' in $$props) actPoolDetailViewNodeIndex = $$props.actPoolDetailViewNodeIndex;
    		if ('actPoolDetailViewLayerIndex' in $$props) actPoolDetailViewLayerIndex = $$props.actPoolDetailViewLayerIndex;
    		if ('detailedViewNum' in $$props) detailedViewNum = $$props.detailedViewNum;
    		if ('disableControl' in $$props) $$invalidate(4, disableControl = $$props.disableControl);
    		if ('cnn' in $$props) cnn = $$props.cnn;
    		if ('detailedViewAbsCoords' in $$props) detailedViewAbsCoords = $$props.detailedViewAbsCoords;
    		if ('imageOptions' in $$props) $$invalidate(12, imageOptions = $$props.imageOptions);
    		if ('selectedImage' in $$props) $$invalidate(5, selectedImage = $$props.selectedImage);
    		if ('nodeData' in $$props) $$invalidate(6, nodeData = $$props.nodeData);
    		if ('selectedNodeIndex' in $$props) $$invalidate(7, selectedNodeIndex = $$props.selectedNodeIndex);
    		if ('isExitedFromDetailedView' in $$props) $$invalidate(8, isExitedFromDetailedView = $$props.isExitedFromDetailedView);
    		if ('isExitedFromCollapse' in $$props) $$invalidate(9, isExitedFromCollapse = $$props.isExitedFromCollapse);
    		if ('customImageURL' in $$props) $$invalidate(10, customImageURL = $$props.customImageURL);
    		if ('detailViewAnchor' in $$props) detailViewAnchor = $$props.detailViewAnchor;
    		if ('logits' in $$props) logits = $$props.logits;
    		if ('selectedI' in $$props) selectedI = $$props.selectedI;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	 (selectedScaleLevelChanged());

    	return [
    		overviewComponent,
    		hoverInfo,
    		modelLoadNotice,
    		selectedNode,
    		disableControl,
    		selectedImage,
    		nodeData,
    		selectedNodeIndex,
    		isExitedFromDetailedView,
    		isExitedFromCollapse,
    		customImageURL,
    		layerColorScales,
    		imageOptions,
    		activateOnKeyboard,
    		imageOptionClicked,
    		customImageClicked,
    		handleModalCanceled,
    		handleCustomImage,
    		handleExitFromDetiledConvView,
    		handleExitFromDetiledPoolView,
    		handleExitFromDetiledActivationView,
    		keydown_handler,
    		keydown_handler_1,
    		div4_binding
    	];
    }

    class Overview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {}, null, [-1, -1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Overview",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src\Explainer.svelte generated by Svelte v3.59.2 */
    const file$c = "src\\Explainer.svelte";

    function create_fragment$c(ctx) {
    	let div;
    	let overview;
    	let current;
    	overview = new Overview({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(overview.$$.fragment);
    			attr_dev(div, "id", "explainer");
    			attr_dev(div, "class", "svelte-1avhf6");
    			add_location(div, file$c, 30, 0, 577);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(overview, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(overview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(overview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(overview);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Explainer', slots, []);

    	const View = {
    		OVERVIEW: 'overview',
    		LAYERVIEW: 'layerview',
    		DETAILVIEW: 'detailview'
    	};

    	let mainView = View.OVERVIEW;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Explainer> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Overview, cnnStore, View, mainView });

    	$$self.$inject_state = $$props => {
    		if ('mainView' in $$props) mainView = $$props.mainView;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [];
    }

    class Explainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Explainer",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* src\Header.svelte generated by Svelte v3.59.2 */

    const file$d = "src\\Header.svelte";

    function create_fragment$d(ctx) {
    	let div2;
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "CAE Explainer";
    			attr_dev(div0, "id", "logo-text");
    			attr_dev(div0, "class", "svelte-104mbne");
    			add_location(div0, file$d, 30, 4, 437);
    			attr_dev(div1, "id", "logo");
    			attr_dev(div1, "class", "svelte-104mbne");
    			add_location(div1, file$d, 29, 2, 416);
    			attr_dev(div2, "id", "header");
    			attr_dev(div2, "class", "svelte-104mbne");
    			add_location(div2, file$d, 27, 0, 393);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file$e = "src\\App.svelte";

    function create_fragment$e(ctx) {
    	let div;
    	let header;
    	let t;
    	let explainer;
    	let current;
    	header = new Header({ $$inline: true });
    	explainer = new Explainer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(header.$$.fragment);
    			t = space();
    			create_component(explainer.$$.fragment);
    			attr_dev(div, "id", "app-page");
    			add_location(div, file$e, 8, 0, 132);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(header, div, null);
    			append_dev(div, t);
    			mount_component(explainer, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(explainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(explainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(header);
    			destroy_component(explainer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Explainer, Header });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
