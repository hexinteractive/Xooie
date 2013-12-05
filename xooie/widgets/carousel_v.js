/*
*   Copyright 2012 Comcast
*
*   Licensed under the Apache License, Version 2.0 (the "License");
*   you may not use this file except in compliance with the License.
*   You may obtain a copy of the License at
*
*       http://www.apache.org/licenses/LICENSE-2.0
*
*   Unless required by applicable law or agreed to in writing, software
*   distributed under the License is distributed on an "AS IS" BASIS,
*   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*   See the License for the specific language governing permissions and
*   limitations under the License.
*/

/**
 * class Xooie.Carousel_v < Xooie.Widget
 *
 * A widget that allows users to horizontally scroll through a collection of elements.  Carousel_vs are
 * commonly used to display a large amount of images or links in a small amount of space.  The user can
 * view more items by clicking the directional controls to scroll the content forward or backward.  If
 * the device recognizes swipe gestues (e.g. mobile or Mac OS) then swiping will also allow the user to
 * scroll content.
 * Keyboard-only users will also be able to navigate from item to item using the tab, left or right keys.
 * Screen reader users will percieve the carousel as a [list](http://www.w3.org/TR/wai-aria/roles#list) of items.
 * For most devices, the native scrollbar is hidden in favor of the directional controls and native scrolling.
 **/
define('xooie/widgets/carousel_v', ['jquery', 'xooie/helpers', 'xooie/widgets/base', 'xooie/event_handler'], function($, helpers, Base, EventHandler) {
  var Carousel_v, timers;

/**
 * Xooie.Carousel_v@xooie-carousel-resize(event)
 * - event (Event): A jQuery event object
 *
 * A jQuery special event triggered to indicate that the carousel instance should be resized.  This
 * by default is triggered when the window is resized.
 **/

  timers = {
    resize: null
  };

  $(window).on('resize', function() {
    if (timers.resize !== null) {
      clearTimeout(timers.resize);
      timers.resize = null;
    }
    if (Carousel_v._cache.length > 0) {
      // TODO: make this delay adjustable
      timers.resize = setTimeout(function() {
        Carousel_v._cache.trigger(Carousel_v.prototype.resizeEvent());
      }, 100);
    }
  });

/** internal
 * Xooie.Carousel_v.parseCtrlStr(ctrlStr) -> Array | undefined
 *
 * Checks the data-x-role value of a control and matches it against expected patterns to determine
 * the control commands, if any.
 * Returns an array: [Direction, Amount, Mode].
 * For example, control:right 1 item -> [right, 1, item], whereas control:right continuous returns
 * [right, undefined, continuous].
 **/
  function parseCtrlStr(ctrlStr) {
    ctrlStr = ctrlStr.toLowerCase();

    var ptrnMatch = ctrlStr.match(/^control:(top|bottom|left|right|goto)\s(\d+)(?:st|nd|rd|th)?\s(.*)$/);

    if(ptrnMatch === null) {
      ptrnMatch = ctrlStr.match(/^control:(top|bottom|left|right)()\s(continuous)$/);
    }

    if (ptrnMatch !== null) {
      return ptrnMatch.slice(1);
    }
  }

/**
 * new Xooie.Carousel_v(element[, addons])
 * - element (Element | String): A jQuery-selected element or string selector for the root element of this widget
 * - addons (Array): An optional collection of [[Xooie.Addon]] classes to be instantiated with this widget
 *
 * Instantiates a new instance of a [[Xooie.Carousel_v]] widget.  Defines [[Xooie.Carousel_v#_timers]],
 * [[Xooie.Carousel_v#_controlEvents]], [[Xooie.Carousel_v#_wrapperEvents]], and [[Xooie.Carousel_v#cropStyle]].
 * Events are bound to the [[Xooie.Widget#root]] to call [[Xooie.Carousel_v#updateDimensions]] on [[Xooie.Widget@xooie-init]],
 * [[Xooie.Widget@xooie-refresh]] and [[Xooie.Carousel_v@xooie-carousel-resize]].
 * Carousel_v instances are tracked in the [[Xooie.Carousel_v._cache]] collection.
 **/
  Carousel_v = Base.extend(function() {
    var self = this;

/** internal
 * Xooie.Carousel_v#_timers -> Object
 *
 * A hash of all timers currently active.  If no timer is active for a particular type then the value is
 * set to undefined.
 *
 * ##### Timers
 * - **scroll** (Integer | undefined): Active while the content is being scrolled.  Prevents post-scroll functionality
 * from triggering until the carousel has completely finished scrolling.
 * - **continuous** (Integer | undefined): Active while the user is continuously scrolling using a [[Xooie.Carousel_v#controls]].
 **/
    this._timers = {
      scroll: 0,
      continuous: 0
    };

/** internal
 * Xooie.Carousel_v#_positioners -> Object
 *
 * A dispatch table containing the various methods for scrolling the carousel content.
 *
 * ##### Positioners
 * - **item**(direction, quantity): Calls [[Xooie.Carousel_v#scrollTo]] with the position of the item designated by the quantity.
 * - **items**(direction, quantity): alias of **item**
 * - **pixel**(direction, quantity): Calls [[Xooie.Carousel_v#scrollTo]] with the pixel position designated by quantity.
 * - **pixels**(direction, quantity): alias of **pixel**
 * - **px**(direction, quantity): alias of **pixel**
 **/
    this._positioners = {

      item: function(direction, quantity) {
        var items, pos, i;

        items = this.items();

        quantity = helpers.toInt(quantity);

        if (isNaN(quantity)) {
          return;
        }

        if (direction === 'goto' && quantity < 1 && quantity <= items.length) {
          // pos = Math.round(items.eq(quantity - 1).position().left);
          pos = Math.round(items.eq(quantity - 1).position().top);
        } else {
          i = this.currentItem(direction === 'right');
          direction = direction === 'left' ? -1 : 1;

          i = Math.max(0, Math.min(items.length - 1, i + (direction * quantity)));

          // pos = this.wrappers().scrollLeft() + Math.round(items.eq(i).position().left);
          pos = this.wrappers().scrollTop() + Math.round(items.eq(i).position().top);
        }

        this.scrollTo(pos);
      },

      items: function() {
        return this._positioners.item.apply(this, arguments);
      },

      pixel: function(direction, quantity) {
        var pos;

        quantity = helpers.toInt(quantity);

        if (isNaN(quantity)) {
          return;
        }

        if (direction === 'goto' && quantity >= 0) {
          pos = quantity;
        } else {
          direction = direction === 'left' ? -1 : 1;

          pos = this.wrappers().scrollLeft() + (direction * quantity);
        }

        this.scrollTo(pos);
      },

      pixels: function() {
        return this._positioners.pixel.apply(this, arguments);
      },

      px: function() {
        return this._positioners.pixel.apply(this, arguments);
      }
    };

/** internal
 * Xooie.Carousel_v#continuousScroll(ctrl, direction)
 * - ctrl (Element): The control that was activated to initiate the scroll
 * - direction (String): The direction of the scroll.  Can be `left` or `right`.
 **/
    function continuousScroll(ctrl, direction) {
      clearInterval(self._timers.continuous);

      self._timers.continuous = setInterval(function(dir) {
        if (ctrl.is(':disabled')) {
          self._timers.continuous = clearInterval(self._timers.continuous);
        }

        //TODO: Need some way of setting rate
        // self.scrollTo(self.wrappers().scrollLeft() + (dir * 5));
        self.scrollTo(self.wrappers().scrollTop() + (dir * 5));
      }, 0, [direction === 'right' ? 1 : -1]);
    }

/** internal
 * Xooie.Carousel_v#_controlEvents -> Object
 *
 * An instance of [[Xooie.EventHandler]] that manages event handlers to be bound to the
 * [[Xooie.Carousel_v#controls]].
 **/
    this._controlEvents = new EventHandler(this.namespace());

    this._controlEvents.add({
      keydown: function(event) {
          var ctrl, args;

          if ([13,32].indexOf(event.which) !== -1) {
            ctrl = $(this);
            args = parseCtrlStr(ctrl.attr('data-x-role'));

            if (args[2] === 'continuous' && !ctrl.is(':disabled')) {
              continuousScroll(ctrl, args[0]);

              event.preventDefault();
            }
          }
      },

      mousedown: function(event) {
        var ctrl, args;

        ctrl = $(this);
        args = parseCtrlStr(ctrl.attr('data-x-role'));

        if (args[2] === 'continuous' && !ctrl.is(':disabled')) {
          continuousScroll(ctrl, args[0]);

          event.preventDefault();
        }
      },

      keyup: function(event) {
        self._timers.continuous = clearInterval(self._timers.continuous);

        if ($(this).is(':disabled')) {
          return;
        }

        if ([13,32].indexOf(event.which) !== -1) {
          var args = parseCtrlStr($(this).attr('data-x-role'));

          if (helpers.isFunction(self._positioners[args[2]])) {
            self._positioners[args[2]].apply(self, args);
          }

          event.preventDefault();
        }
      },

      mouseup: function(event) {
        self._timers.continuous = clearInterval(self._timers.continuous);

        if ($(this).is(':disabled')) {
          return;
        }

        var args = parseCtrlStr($(this).attr('data-x-role'));

        if (helpers.isFunction(self._positioners[args[2]])) {
          self._positioners[args[2]].apply(self, args);
        }

        event.preventDefault();
      },

      mouseleave: function(event) {
        self._timers.continuous = clearInterval(self._timers.continuous);
      },

      blur: function(event) {
        self._timers.continuous = clearInterval(self._timers.continuous);
      }
    });

    function scrollComplete() {
      self._timers.scroll = clearTimeout(self._timers.scroll);

      self.updateLimits();
    }

/** internal
 * Xooie.Carousel_v#_wrapperEvents -> Object
 *
 * An instance of [[Xooie.EventHandler]] that manages event handlers to be bound to the
 * [[Xooie.Carousel_v#wrappers]].
 **/
    this._wrapperEvents = new EventHandler(this.namespace());

    this._wrapperEvents.add('scroll', function(event){
      if (self._timers.scroll) {
          self._timers.scroll = clearTimeout(self._timers.scroll);
        } else {
          self.root().removeClass(self.leftClass() + ' ' + self.rightClass());

          self.controls().prop('disabled', false);
        }

        // TODO: make this delay adjustable
        self._timers.scroll = setTimeout(scrollComplete, 250);
    });

    this.cropStyle(Carousel_v.createStyleRule('.' + this.instanceClass() + ' .' + this.cropClass() + ', .' + this.instanceClass() + '.' + this.cropClass()));

    // TODO: add functionality to remove from cache
    Carousel_v._cache = Carousel_v._cache.add(this.root());

    this.root().on([
      this.get('initEvent'),
      this.get('refreshEvent'),
      this.get('resizeEvent')].join(' '),
    function(){
      self.updateDimensions();
    });

  });

/** internal
 * Xooie.Carousel_v._cache -> jQuery
 *
 * A jQuery collection that keeps track of currently instantiated carousel instances.  This collection
 * is primarily used during a window resize event, where the limits and dimensions are recalculated.
 **/
  Carousel_v._cache = $();

/** internal
 * Xooie.Carousel_v#_namespace -> String
 *
 * See [[Xooie.Widget#_namespace]]
 * Default: `carousel`.
 **/
/**
 * Xooie.Carousel_v#namespace([value]) -> String
 * - value: an optional value to be set.
 *
 * See [[Xooie.Widget#namespace]]
 **/
  Carousel_v.define('namespace', 'carousel');

/** internal
 * Xooie.Carousel_v#_isScrolling -> Boolean
 *
 * A value that determines whether or not the carousel is currently scrolling
 * TODO:  Perhaps depricate this in favor of scroll timer detection
 * Default: `false`.
 **/
/**
 * Xooie.Carousel_v#isScrolling([value]) -> String
 * - value: an optional value to be set.
 *
 **/
  Carousel_v.define('isScrolling', false);

/** internal
 * Xooie.Carousel_v#_visibleThreshold -> Integer
 *
 * Default: `0.5`.
 **/
/**
 * Xooie.Carousel_v#visibleThreshold([value]) -> Integer
 * - value: an optional value to be set.
 *
 **/
  Carousel_v.define('visibleThreshold', 0.5);

/** internal
 * Xooie.Carousel_v#_cropStyle -> cssRule
 *
 * Default: `carousel`.
 **/
/**
 * Xooie.Carousel_v#cropStyle([value]) -> cssRule
 * - value: an optional value to be set.
 *
 **/
  Carousel_v.define('cropStyle');

/** internal, read-only
 * Xooie.Carousel_v#_resizeEvent -> String
 *
 * Default: `xooie-carousel-resize`.
 **/
/**
 * Xooie.Carousel_v#resizeEvent() -> String
 *
 **/
  Carousel_v.defineReadOnly('resizeEvent', 'xooie-carousel-v-resize');

/** internal, read-only
 * Xooie.Carousel_v#_wrapperClass -> String
 *
 * Default: `xooie-carousel-wrapper`.
 **/
/**
 * Xooie.Carousel_v#wrapperClass() -> String
 *
 **/
  Carousel_v.defineReadOnly('wrapperClass', 'xooie-carousel-v-wrapper');

/** internal, read-only
 * Xooie.Carousel_v#_cropClass -> String
 *
 * Default: `xooie-carousel-crop`.
 **/
/**
 * Xooie.Carousel_v#cropClass() -> String
 *
 **/
  Carousel_v.defineReadOnly('cropClass', 'xooie-carousel-v-crop');

/** internal, read-only
 * Xooie.Carousel_v#_contentClass -> String
 *
 * Default: `xooie-carousel-content`.
 **/
/**
 * Xooie.Carousel_v#contentClass() -> String
 *
 **/
  Carousel_v.defineReadOnly('contentClass', 'xooie-carousel-v-content');

/** internal, read-only
 * Xooie.Carousel_v#_controlClass -> String
 *
 * Default: `xooie-carousel-control`.
 **/
/**
 * Xooie.Carousel_v#controlClass() -> String
 *
 **/
  Carousel_v.defineReadOnly('controlClass', 'xooie-carousel-v-control');

/** internal, read-only
 * Xooie.Carousel_v#_leftClass -> String
 *
 * Default: `is-left-limit`.
 **/
/**
 * Xooie.Carousel_v#leftClass() -> String
 *
 **/
  Carousel_v.defineReadOnly('leftClass', 'is-left-limit');

/** internal, read-only
 * Xooie.Carousel_v#_rightClass -> String
 *
 * Default: `is-right-limit`.
 **/
/**
 * Xooie.Carousel_v#rightClass() -> String
 *
 **/
  Carousel_v.defineReadOnly('rightClass', 'is-right-limit');

// ROLE DEFINITIONS

/**
 * Xooie.Carousel_v#wrapper() -> Elements
 *
 *
 **/
  Carousel_v.defineRole('wrapper');

/**
 * Xooie.Carousel_v#content() -> Elements
 *
 * This role maps to the ARIA [tab list](http://www.w3.org/TR/wai-aria/roles#list)
 **/
  Carousel_v.defineRole('content');

/**
 * Xooie.Carousel_v#item() -> Elements
 *
 * This role maps to the ARIA [listitem role](http://www.w3.org/TR/wai-aria/roles#listitem)
 **/
  Carousel_v.defineRole('item');

/**
 * Xooie.Carousel_v#control() -> Elements
 *
 * Controls allow the user to scroll the carousel.  The behavior of this scrolling is determined by
 * the role itself.  Behavior is set using the `data-x-role` attribute: `data-x-role="control:<direction> <quantity> <mode>"`.
 * The `direction` value indicates which direction the carousel should be moved: `right`, `left`, or `goto`.
 * The special `goto` value signifies that the control should scroll to a fixed position.
 * The control syntax is designed to accept somewhat natural language.  Therefore, plurals and n-aries can be used to
 * describe the behavior.  For example, you can use the following strings: `control:right 2 items`, `control:left 30 pixels`,
 * `control:goto 5th item`.
 **/
  Carousel_v.defineRole('control');

// STYLE DEFINITIONS

  Carousel_v.createStyleRule('.' + Carousel_v.prototype.wrapperClass(), {
    position: 'relative',
    // 'overflow-x': 'scroll',
    // 'overflow-y': 'hidden'
    'overflow-y': 'scroll',
    'overflow-x': 'hidden',
    'height': '100%' //when the carousel is horizontal the markup's default width is 100%
  });

  Carousel_v.createStyleRule('.' + Carousel_v.prototype.cropClass(), {
    // 'overflow-y': 'hidden'
    'overflow-x': 'hidden'
  });

  Carousel_v.createStyleRule('.' + Carousel_v.prototype.contentClass(), {
    display: 'table-cell',
    // 'white-space': 'nowrap',
    'font-size': '0px',
    // 'transition': 'left 0.5s'
    'transition': 'top 0.5s'
  });

  Carousel_v.createStyleRule('ul.' + Carousel_v.prototype.contentClass(), {
     'list-style': 'none',
     'padding': 0,
     'margin': 0
  });

  Carousel_v.createStyleRule('.' + Carousel_v.prototype.contentClass() + ' > *', {
    // display: 'inline-block',
    display: 'block',
    // zoom: '1',
    // '*display': 'inline',
    'font-size': '1em'
  });

  Carousel_v.createStyleRule('.' + Carousel_v.prototype.leftClass() + '.' + Carousel_v.prototype.rightClass() + ' [data-x-role^="control:left"]' +
    ', .' + Carousel_v.prototype.leftClass() + '.' + Carousel_v.prototype.rightClass() + ' [data-x-role^="control:right"]', {
    display: 'none'
  });

/**
 * Xooie.Carousel_v#currentItem(biasRight) -> Integer
 * - biasRight (Boolean): If true, calculates the current item from the right side of the carousel.
 *
 * Returns the index of the first visible item.  The value of [[Xooie.Carousel_v#visibleThreshold]] determines what
 * percentage of the item must be showing to be considered visible.
 **/
  Carousel_v.prototype.currentItem = function(biasRight) {
      var content,
          items,
          position,
          // itemWidth,
          itemHeight,
          i;

      content = this.contents();
      items = this.items();

      if (biasRight) {
        // position = content.outerWidth(true) + content.position().left;
        position = content.outerHeight(true) + content.position().top;

        for (i = items.length - 1; i > 0; i -= 1) {
          // itemHeight = items.eq(i).outerWidth(true);
          itemHeight = items.eq(i).outerHeight(true);
          position -= itemHeight;

          if (i > 0 && position <= this.visibleThreshold() * itemHeight) {
              return i;
          }
        }
        return 0;
      } else {
        // position = content.position().left;
        position = content.position().top;

        for (i = 0; i < items.length - 1; i++) {
          // itemHeight = items.eq(i).outerWidth(true);
          itemHeight = items.eq(i).outerHeight(true);

          if (position + this.visibleThreshold() * itemHeight >= 0){
            return i;
          } else {
            position += itemHeight;
          }
        }

        return items.length - 1;
      }
  };

/**
 * Xooie.Carousel_v#isLeft() -> Boolean
 *
 * Indicates if the carousel is scrolled completely to the left.
 **/
  Carousel_v.prototype.isLeft = function() {
    // return this.wrappers().scrollLeft() === 0;
    return this.wrappers().scrollTop() === 0;
  };

/**
 * Xooie.Carousel_v#isRight() -> Boolean
 *
 * Indicates if the carousel is scrolled completely to the right.
 **/
  Carousel_v.prototype.isRight = function() {
    var lastItem, position;

    try {
      lastItem = this.items().filter(':visible:last');
      position = lastItem.position();

      // if (position && !helpers.isUndefined(position.left)) {
      if (position && !helpers.isUndefined(position.top)) {
        // return Math.floor(position.left) + lastItem.outerWidth(true) <= this.wrappers().innerWidth();
        // return Math.floor(position.top) + lastItem.outerHeight(true) <= this.wrappers().innerHeight();
        var bottom = Math.floor(position.top) + lastItem.outerHeight(true) <= this.wrappers().innerHeight();
        console.log('bottom: ',bottom);
        return bottom;
      }
    } catch (e) {
      return false;
    }

    return false;
  };

/**
 * Xooie.Carousel_v#updateDimensions()
 *
 * Updates the height of the carousel based on the height of the tallest visible item in the carousel.
 * The new height is applied to the [[Xooie.Carousel_v#cropStyle]] rule rather than the cropping element
 * itself.  This allows developers to use cascade rules to override the height if they so choose.
 **/
  Carousel_v.prototype.updateDimensions = function() {
    // var height = 0;
    var width = 0;

    this.items().each(function(){
      // height = Math.max(height, $(this).outerHeight(true));
      width = Math.max(width, $(this).outerWidth(true));
    });

    //set the height of the wrapper's parent (or cropping element) to ensure we hide the scrollbar
    // this.cropStyle().style.height = height + 'px';
    this.cropStyle().style.width = width + 'px';

    this.updateLimits();
  };

/**
 * Xooie.Carousel_v#updateLimits()
 *
 * Updates the state of the carousel based on whether or not it is scrolled completely to the left or the right.
 * If the carousel is scrolled completely to the left then the [[Xooie.Carousel_v#leftClass]] is applied to the
 * [[Xooie.Widget#root]] and the left [[Xooie.Carousel_v#controls]] is disabled.  If the carousel is scrolled
 * completely to the left then the [[Xooie.Carousel_v#rightClass]] is applied to the [[Xooie.Widget#root]] and the
 * right [[Xooie.Carousel_v#controls]] is disabled.
 **/
  Carousel_v.prototype.updateLimits = function() {
      var isLeft = this.isLeft(),
          isRight = this.isRight();

      this.root().toggleClass(this.leftClass(), isLeft);
      this.controls().filter('[data-x-role^="control:left"]')
                     .prop('disabled', isLeft);

      this.root().toggleClass(this.rightClass(), isRight);
      this.controls().filter('[data-x-role^="control:right"]')
                     .prop('disabled', isRight);
  };

/**
 * Xooie.Carousel_v#scrollTo(pos, cb)
 * - pos (Integer): The position to which the carousel will be scrolled.
 * - cb (Function): A callback function that is called when the animation is complete.
 *
 * Uses the jQuery animate functionality to scroll the carousel to the designated position.
 **/
  Carousel_v.prototype.scrollTo = function(pos, cb) {
    var self = this;

    pos = Math.floor(pos);

    if (this.isScrolling) {
      this.wrappers().stop(true,true);
    }

    this.isScrolling = true;

    // TODO: make the scroll timer configurable
    // this.wrappers().animate({ scrollLeft: pos }, 200,
      this.wrappers().animate({ scrollTop: pos }, 200,
      function(){
        self.isScrolling = false;
        if (helpers.isFunction(cb)) {
          cb();
        }
      }
    );
  };

/** internal
 * Xooie.Carousel_v#_process_role_content(content) -> Element
 * - content (Element): A jQuery-selected collection of [[Xooie.Carousel_v#contents]]
 *
 * This method processes the element that has been designated as a [[Xooie.Carousel_v#contents]].
 * In addition to applying the [[Xooie.Carousel_v#contentClass]] the content is also given the
 * aria role [list](http://www.w3.org/TR/wai-aria/roles#list) if it is neither a `ul` or `ol` element.
 **/
  Carousel_v.prototype._process_role_content = function(content) {
    content.addClass(this.contentClass());

    if (!content.is('ul,ol')) {
      content.attr('role', 'list');
    }

    return content;
  };

/** internal
 * Xooie.Carousel_v#_render_role_wrapper() -> Element
 *
 * Renders a `div` tag that is wrapped around the [[Xooie.Carousel_v#contents]].  This element is
 * rendered only if no other [[Xooie.Carousel_v#wrappers]] is present as a decendant of the root of this
 * widget.
 **/
  Carousel_v.prototype._render_role_wrapper = function() {
    var wrapper = $('<div data-x-role="wrapper" />');

    this.contents().wrap(wrapper);

    return this.contents().parent();
  };

/** internal
 * Xooie.Carousel_v#_process_role_wrapper(wrapper) -> Element
 * - wrapper (Element): A jQuery-selected collection of [[Xooie.Carousel_v#wrappers]]
 *
 * This method processes the element that has been designated as a [[Xooie.Carousel_v#wrappers]].
 * The [[Xooie.Carousel_v#wrapperClass]] is added and the [[Xooie.Carousel_v#_wrapperEvents]] handlers are
 * bound.  Also, the [[Xooie.Carousel_v#cropClass]] is added to this element's parent.
 **/
  Carousel_v.prototype._process_role_wrapper = function(wrapper) {
    wrapper.addClass(this.wrapperClass())
           .on(this._wrapperEvents.handlers)
           .parent().addClass(this.cropClass());

    return wrapper;
  };

/** internal
 * Xooie.Carousel_v#_get_role_item() -> Element
 *
 * Gets all children of [[Xooie.Carousel_v#contents]].
 **/
  Carousel_v.prototype._get_role_item = function() {
    return this.contents().children();
  };

/** internal
 * Xooie.Carousel_v#_get_role_control() -> Element
 *
 * TODO: Test and document
 **/
  Carousel_v.prototype._get_role_control = function(){
    return this.root().find('[data-x-role^="control"]');
  };

/** internal
 * Xooie.Carousel_v#_process_role_control() -> Element
 *
 **/
  Carousel_v.prototype._process_role_control = function(controls) {
    controls.on(this._controlEvents.handlers);

    controls.attr('aria-hidden', true)
            .addClass(this.controlClass());

    return controls;
  };

/** internal
 * Xooie.Carousel_v#_process_resizeEvent() -> String
 *
 * Adds the [[Xooie.Widget#namespace]] to the `resizeEvent` string.
 **/
  Carousel_v.prototype._process_resizeEvent = function(resizeEvent) {
    return this.namespace() === '' ? resizeEvent : resizeEvent + '.' + this.namespace();
  };

  return Carousel_v;
});