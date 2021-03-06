(function (context, definition) {

  'use strict';

  if (typeof module != 'undefined' && module.exports) {
    module.exports = definition();
  } else if (typeof define == 'function' && define.amd) {
    define(function() {
      return (window.SimpleSlider = definition());
    });
  } else {
    context.SimpleSlider = definition();
  }

})(this, function () {

  'use strict';

  // requestAnimationFrame polyfill

  if (!Date.now)
    Date.now = function() { return new Date().getTime(); };

  var vendors = ['webkit', 'moz'];
  for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
    var vp = vendors[i];
    window.requestAnimationFrame = window[vp+'RequestAnimationFrame'];
    window.cancelAnimationFrame = (window[vp+'CancelAnimationFrame'] || window[vp+'CancelRequestAnimationFrame']);
  }

  if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || // iOS6 is buggy
    !window.requestAnimationFrame || !window.cancelAnimationFrame) {
    var lastTime = 0;
    window.requestAnimationFrame = function(callback) {
      var now = Date.now();
      var nextTime = Math.max(lastTime + 16, now);
      return setTimeout(function() { callback(lastTime = nextTime); }, nextTime - now);
    };
    window.cancelAnimationFrame = clearTimeout;
  }

  // ------------------

  function getdef(val, def){
    return val===undefined || val===null || val==='' ? def : val;
  }

  // Extracts the unit from a css value
  function getUnit(args, transitionProperty) {

    var item;
    var count = args.length;
    var unit = '';

    while (--count >= 0) {
      item = args[count];
      if (typeof item === 'string') {
        unit = item
          .replace(parseInt(item, 10) + '', '');
      }
    }

    // Defaults unit to px if transition property isn't opacity
    if (transitionProperty !== 'opacity' && unit === '') {
      unit = 'px';
    }

    return unit;

  }

  // Test if have children and throw warning otherwise
  function testChildrenNum(value) {

    if (value <= 0) {
      try {
        console.warn(
          'A SimpleSlider main container element' +
          'should have at least one child.'
        );
      } catch(e) {}

      return true;

    } else {

      return false;
    }

  }

  function anim(target, prop, unit, transitionDuration, startTime, elapsedTime, fromValue, toValue, easeFunc){

    function loop() {

      window.requestAnimationFrame(function requestAnimationFunction(time){

        // Starts time in the first anim iteration
        if (startTime === 0) {
          startTime = time;
        }

        anim(target, prop, unit, transitionDuration, startTime, time, fromValue, toValue, easeFunc);

      });
    }

    var newValue;

    if (startTime === 0) {

      return loop();

    } else {

      newValue = easeFunc(elapsedTime - startTime, fromValue, toValue - fromValue, transitionDuration);

      if (elapsedTime - startTime <= transitionDuration) {

        target[prop] = newValue + unit;

        loop();

      } else {

        target[prop] = (toValue) + unit;
      }
    }

  }

  function startSlides(container, unit, startValue, visibleValue, transitionProperty) {

    var imgs = [];
    var i = container.children.length;

    while (--i >= 0) {
      imgs[i] = container.children[i];
      imgs[i].style.position = 'absolute';
      imgs[i].style.top = '0' + unit;
      imgs[i].style.left = '0' + unit;
      imgs[i].style[transitionProperty] = startValue + unit;
      imgs[i].style.zIndex = 0;
    }

    imgs[0].style[transitionProperty] = visibleValue + unit;
    imgs[0].style.zIndex = 1;

    return imgs;

  }

  function manageRemovingSlideOrder(oldSlide, newSlide) {

    newSlide.style.zIndex = 3;

    if (oldSlide) {
      oldSlide.style.zIndex = 1;
    }

    return newSlide;
  }

  function manageInsertingSlideOrder(oldSlide, newSlide) {

    newSlide.style.zIndex = 4;

    if (oldSlide) {
      oldSlide.style.zIndex = 2;
    }

    return newSlide;
  }

  function parseStringToBoolean(value) {

    if (value === 'false') {
      return false;
    } else {
      return value;
    }

  }

  // ------------------

  var SimpleSlider = function(containerElem, options){

    this.containerElem = containerElem;
    this.interval = null;

    // User might not send any custom options at all
    if( !options ) {
      options = {};
    }

    var width = parseInt(this.containerElem.style.width || this.containerElem.offsetWidth, 10);

    // Get user defined options or its default values
    this.trProp = getdef(options.transitionProperty, 'left');
    this.trTime = getdef(options.transitionDuration, 0.5);
    this.delay = getdef(options.transitionDelay, 3);
    this.unit = getUnit([options.startValue, options.visibleValue, options.endValue], this.trProp);
    this.startVal = parseInt(getdef(options.startValue, -width + this.unit), 10);
    this.visVal = parseInt(getdef(options.visibleValue, '0' + this.unit), 10);
    this.endVal = parseInt(getdef(options.endValue, width + this.unit), 10);
    this.autoPlay = getdef(parseStringToBoolean(options.autoPlay), true);
    this.ease = getdef(options.ease, SimpleSlider.defaultEase);

    this.init();
  };

  SimpleSlider.defaultEase = function (time, begin, change, duration) {

    if ((time = time / (duration / 2)) < 1) {
      return change / 2 * time * time * time + begin;
    } else {
      return change / 2 * ((time -= 2) * time * time + 2) + begin;
    }

  };

  SimpleSlider.easeNone = function(time, begin, change, duration) {

    return change * time / duration + begin;

  };

  SimpleSlider.prototype.init = function() {

    this.reset();
    this.configSlideshow();

  };

  SimpleSlider.prototype.reset = function() {

    if (testChildrenNum(this.containerElem.children.length)) {
      return; // Skip reset logic if don't have children
    }

    this.containerElem.style.position = 'relative';
    this.containerElem.style.overflow = 'hidden';
    this.containerElem.style.display = 'block';

    this.imgs = startSlides(this.containerElem, this.unit, this.startVal, this.visVal, this.trProp);

    this.actualIndex = 0;
    this.inserted = null;
    this.removed = null;

  };

  SimpleSlider.prototype.configSlideshow = function() {

    if (!this.imgs) {
      return false;
    }

    this.startInterval();

  };

  SimpleSlider.prototype.startInterval = function () {

    var self = this;

    if (!this.autoPlay || this.imgs.length <= 1) {
      return;
    }

    if (this.interval) {
      window.clearInterval(this.interval);
    }

    this.interval = window.setInterval(function(){
      self.change(self.nextIndex());
    }, this.delay * 1000);

  };

  SimpleSlider.prototype.startAnim = function(target, fromValue, toValue){

    anim(target.style, this.trProp, this.unit, this.trTime * 1000, 0, 0, fromValue, toValue, SimpleSlider.defaultEase);

  };

  SimpleSlider.prototype.remove = function(index){

    this.removed = manageRemovingSlideOrder(this.removed, this.imgs[index]);

    this.startAnim(this.imgs[index], this.visVal, this.endVal);

  };

  SimpleSlider.prototype.insert = function(index){

    this.inserted = manageInsertingSlideOrder(this.inserted, this.imgs[index]);

    this.startAnim(this.imgs[index], this.startVal, this.visVal);

  };

  SimpleSlider.prototype.change = function(newIndex){

    this.remove(this.actualIndex);
    this.insert(newIndex);

    this.actualIndex = newIndex;

  };

  SimpleSlider.prototype.next = function(){

    this.change(this.nextIndex());

    this.startInterval();

  };

  SimpleSlider.prototype.prev = function(){

    this.change(this.prevIndex());

    this.startInterval();

  };

  SimpleSlider.prototype.nextIndex = function(){

    var newIndex = this.actualIndex+1;

    if (newIndex >= this.imgs.length) {
      newIndex = 0;
    }

    return newIndex;

  };

  SimpleSlider.prototype.prevIndex = function(){

    var newIndex = this.actualIndex-1;

    if (newIndex < 0) {
      newIndex = this.imgs.length-1;
    }

    return newIndex;

  };

  SimpleSlider.prototype.dispose = function(){

    window.clearInterval(this.interval);

    if (this.imgs) {
      var i = this.imgs.length;
      while (--i >= 0) {
        this.imgs.pop();
      }
      this.imgs = null;
    }

    this.containerElem = null;
    this.interval = null;
    this.trProp = null;
    this.trTime = null;
    this.delay = null;
    this.startVal = null;
    this.endVal = null;
    this.autoPlay = null;
    this.actualIndex = null;
    this.inserted = null;
    this.removed = null;
  };

  return SimpleSlider;

});
