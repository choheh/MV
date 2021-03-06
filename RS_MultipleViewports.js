/*:
 * RS_MultipleViewports.js
 * @plugindesc (v1.2.0) This plugin provides the multiple viewports.
 * @author biud436
 *
 * @param Maximum viewport
 * @desc Sets the number of viewports to display on the screen.
 * @default 4
 *
 * @param Viewport orientation
 * @desc Sets the viewport to portrait orientation.
 * @default true
 *
 * @help
 * -----------------------------------------------------------------------------
 * Plugin Commands
 * -----------------------------------------------------------------------------
 *
 * This is a plugin command that this can activate the multiple viewports.
 * If you call this plugin command, You can be using the multiple viewports.
 * - MultipleViewport Enable
 *
 * This can disable the multiple viewports.
 * Note that any drawing object of previous viewport is not removed in memory.
 * So if you will need it, you try to call the MultipleViewport ClearImage plugin command.
 * If you call this plugin command, You can be using original stage renderer.
 * - MultipleViewport Disable
 *
 * This is the plugin command you can set the power of the viewport shake.
 * - MultipleViewport StartShake shakePower
 *
 * This is the plugin command you can set the end of the viewport shake.
 * - MultipleViewport EndShake
 *
 * This is the plugin command you can set an image to certain viewport.
 * (View ID is number between 1 and 4)
 * - MultipleViewport Image ViewID ImageName
 *
 * This is the plugin command you can delete the image to certain viewport.
 * (View ID is number between 1 and 4)
 * - MultipleViewport ClearImage ViewID
 *
 * This is the plugin command that can set the video to certain viewport.
 * Note that the file type should set the WEBM(.webm)
 * ViewID is the number between 1 and 4.
 * szSrc Indicates an video name from the movies directory.
 * loop allows you to set with the true or false.
 * You can repeat the video via this value. (If you are omitted this loop value, its video will only play once.)
 *
 * - MultipleViewport Video viewID szSrc loop
 *
 * This command moves back x seconds from current video position.
 * - MultipleViewport MoveBackSeconds viewID second
 *
 * This command moves forward x seconds from current video position.
 * - MultipleViewport MoveForwardSeconds viewID second
 *
 * This is the plugin command can play the video to certain viewport.
 * - MultipleViewport PlayVideo viewID
 *
 * This is the plugin command can stop the video to certain viewport.
 * - MultipleViewport StopVideo viewID
 *
 * This is the plugin command can pause the video to certain viewport.
 * - MultipleViewport PauseVideo viewID
 *
 * This is the plugin command can remove the video to certain viewport.
 * - MultipleViewport ClearVideo viewID
 *
 * -----------------------------------------------------------------------------
 * Changle Log
 * -----------------------------------------------------------------------------
 * 2016.06.13 (v1.0.0) - First Release.
 * 2016.08.24 (v1.1.0) - Now RPG Maker MV 1.3.0 or more is supported.
 * 2016.08.24 (v1.1.2) - Added Plugin Commands
 * 2016.08.25 (v1.1.4) - Added the functions that sets an image of certain viewport.
 * 2016.09.30 (v1.1.5) - Added the function that plays an video of certain viewport.
 * 2016.10.01 (v1.1.6) - Added the rendering code that is compatible with the canvas mode.
 * 2016.10.20 (v1.1.7) - Fixed the issue that is not working in RMMV 1.3.2
 * 2016.10.23 (v1.1.8) - Fixed the issue that the video frame is not updated in PIXI 4.0.3
 * 2016.11.24 (v1.1.9) - Now this can change the viewport orientation such as portrait, landscape and can also set the number of viewports.
 * 2016.11.26 (v1.2.0) - Added certain code to remove the texture from memory.
 */

var Imported = Imported || {};
Imported.RS_MultipleViewports = true;

var RS = RS || {};
RS.MultipleViewports = RS.MultipleViewports || {};

(function () {

  var isFilterPIXI4 = (PIXI.VERSION >= "4.0.0" && Utils.RPGMAKER_VERSION >= "1.3.0");

  var isMultipleViewport = false;
  var isShake = 0;
  var shakePower = 10;

  var isStoppingMainScene = false;

  var parameters = PluginManager.parameters('RS_MultipleViewports');
  var maxDisplayCounts = Number(parameters['Maximum viewport'] || 4);

  RS.MultipleViewports.isVertical = Boolean(parameters['Viewport orientation'] === 'false');

  //============================================================================
  // Fixed bug in library that can not play the texture video in PIXI 4.0.3 version.
  //============================================================================

  var ticker = PIXI.ticker;

  PIXI.VideoBaseTexture.prototype._onPlayStart = function _onPlayStart() {
      // Just in case the video has not recieved its can play even yet..
      if (!this.hasLoaded) {
          this._onCanPlay();
      }

      if (!this._isAutoUpdating && this.autoUpdate) {
          ticker.shared.add(this.update, this);
          ticker.shared.stop();
          ticker.shared.start();
          this._isAutoUpdating = true;

      }
  };

  //============================================================================
  // Graphics
  //============================================================================

  Graphics.getRenderPosition = function(width, height) {
    var positionType = [];
    var w, h;
    switch (maxDisplayCounts) {
      case 2: case 3:
        var size = maxDisplayCounts;
        if(RS.MultipleViewports.isVertical) {
          w = width / size;
          h = height;
          this._mtHorizontalScale = 1 / maxDisplayCounts;
          this._mtVerticalScale = 1.0;
        } else {
          w = width;
          h = height / size;
          this._mtHorizontalScale = 1.0;
          this._mtVerticalScale = (1 / maxDisplayCounts);
        }
        for(var i = vx = vy = 0; i < maxDisplayCounts; i++) {
          vx = (i % maxDisplayCounts);
          vy = (i / maxDisplayCounts);
          if(RS.MultipleViewports.isVertical) {
            positionType[i] = new Rectangle(w * vx, 0, w, h);
          } else {
            positionType[i] = new Rectangle(0, h * i, w, h);
          }
        }
        break;
      case 4: // Grid
        w = width / 2;
        h = height / 2;
        this._mtHorizontalScale = 1 / 2;
        this._mtVerticalScale = 1 / 2;
        for(var i = vx = vy = 0; i < maxDisplayCounts; i++) {
          vx = (i % 2);
          vy = Math.floor(i / 2);
          positionType[i] = new Rectangle(w * vx, h * vy, w, h);
        }
        break;
    }
    return positionType;
  };

  var alias_Graphics__createRenderer = Graphics._createRenderer;
  Graphics._createRenderer = function() {
    alias_Graphics__createRenderer.call(this);
    this._createRenderTexture();
  };

  Graphics._createRenderTexture = function () {
    var sprite; var rect; var self = Graphics;
    if(!self._renderer) { return; }
    if(this.isWebGL()) var gl = self._renderer.gl;
    self._renderSprite = [];

    // Calculrate Screen
    if(this.isWebGL()) {
      self._frameWidth = gl.drawingBufferWidth || 816;
      self._frameHeight = gl.drawingBufferHeight || 624;
    } else {
      self._frameWidth = self._renderer.width || 816;
      self._frameHeight = self._renderer.height || 624;
    }

    // Create RenderTexture
    self._renderTexture = PIXI.RenderTexture.create(self._frameWidth,
                                                    self._frameHeight,
                                                    PIXI.SCALE_MODES.NEAREST);

    // Create Rect
    self._rect = self.getRenderPosition(self._frameWidth, self._frameHeight);

    // Create RenderTarget
    if(this.isWebGL()) {
      self._renderTarget = new PIXI.RenderTarget(gl, self._frameWidth,
                                                    self._frameHeight,
                                                    PIXI.SCALE_MODES.NEAREST);
    } else {
      self._renderTarget = new PIXI.CanvasRenderTarget(self._frameWidth, self._frameHeight);
    }

    // Create Sprite
    self._renderSprite = new Sprite();

    // Add Child Sprite
    for(var i = 0; i < maxDisplayCounts; i++) {
      self._renderSprite.addChild(new Sprite());
    }

    self._viewImageCached = [];

    self._renderBounds = new Rectangle(0, 0, self._frameWidth, self._frameHeight);

  }

  Graphics.setRenderSprite = function (i) {

    var sPower = shakePower * isShake;
    var shake = (-0.5 + Math.random()) * sPower;
    var child = this._renderSprite.getChildAt(i);
    var otherStage = RS.MultipleViewports.stage;

    child.x = this._rect[i].x + shake;
    child.y = this._rect[i].y + shake;

      if(Graphics.isCheckedViewImage(i)) {

        var texture = child.texture = this._viewImageCached[i];
        child.scale.x = (Graphics.boxWidth / texture.width) * this._mtHorizontalScale;
        child.scale.y = (Graphics.boxHeight / texture.height) * this._mtVerticalScale;

      } else {

        child.texture = this._renderTexture;
        child.scale.x = this._mtHorizontalScale;
        child.scale.y = this._mtVerticalScale;

      }

  };

  Graphics.setViewportImage = function (viewID, texture) {
    if(this._viewImageCached[viewID - 1]) {
      this._viewImageCached[viewID - 1] = null;
    }
    this._viewImageCached.splice(viewID - 1, texture);
    this._viewImageCached[viewID - 1] = texture;
  };

  Graphics.moveMoviesToCertainView = function (viewID, funcName, second) {
    var texture = this._viewImageCached[viewID - 1];
    if(texture && texture.baseTexture instanceof PIXI.VideoBaseTexture) {
      var video = texture.baseTexture.source;
      switch (funcName) {
        case 'Move Back':
          if(video) video.currentTime -= second;
          break;
        case 'Move Forward':
          if(video) video.currentTime += second;
          break;
      }
    }
  };

  Graphics.playMoviesToCertainView = function (viewID) {
    var texture = this._viewImageCached[viewID - 1];
    if(texture && texture.baseTexture instanceof PIXI.VideoBaseTexture) {
      var video = texture.baseTexture.source;
      if(video) {
        video.play();
      } else {
        if(texture.baseTexture._onCanPlay) texture.baseTexture._onCanPlay();
      }
    }
  };

  Graphics.pauseMoviesToCertainView = function (viewID) {
    var texture = this._viewImageCached[viewID - 1];
    if(texture && texture.baseTexture instanceof PIXI.VideoBaseTexture) {
      var video = texture.baseTexture.source;
      if(video) video.pause();
    }
  };

  Graphics.stopMoviesToCertainView = function (viewID) {
    var texture = this._viewImageCached[viewID - 1];
    if(texture && texture.baseTexture instanceof PIXI.VideoBaseTexture) {
      var video = texture.baseTexture.source;
      if(video) {
        video.pause();
        video.currentTime = 0.0;
      }
    }
  };

  Graphics.pauseAllMovies = function () {
    this._viewImageCached.forEach(function (i) {
      if(i.baseTexture instanceof PIXI.VideoBaseTexture) i.baseTexture.source.pause();
    })
  };

  Graphics.playAllMovies = function () {
    this._viewImageCached.forEach(function (i) {
      if(i.baseTexture instanceof PIXI.VideoBaseTexture) i.baseTexture.source.play();
    })
  };

  Graphics.isCheckedViewImage = function (viewID) {
    var texture = this._viewImageCached[viewID];
    if(texture instanceof PIXI.Texture) {
      return !!texture.baseTexture && texture.baseTexture.hasLoaded;
    } else {
      return false;
    }
  };

  Graphics.clearViewImage = function (viewID) {
    if(this._viewImageCached[viewID - 1]) {
        var texture = this._viewImageCached[viewID - 1];
        texture.destroy({ destroyBase: true });
        delete this._viewImageCached[viewID - 1];
    }
  };

  Graphics.render = function(stage) {
    if (this._skipCount === 0) {
        var startTime = Date.now();
        if (stage) {
          if(isMultipleViewport) {
            if(this.isWebGL()) this._renderer.bindRenderTexture(this._renderTexture);
            this._renderer.render(stage, this._renderTexture);
            if(this.isWebGL()) this._renderer.bindRenderTarget(this._renderTarget);
            for(var i = 0; i < maxDisplayCounts; i++) this.setRenderSprite(i);
            this._renderer.render(this._renderSprite);
          } else {
            this._renderer.render(stage);
          }
        }
        var endTime = Date.now();
        var elapsed = endTime - startTime;
        this._skipCount = Math.min(Math.floor(elapsed / 15), this._maxSkip);
        this._rendered = true;
    } else {
        this._skipCount--;
        this._rendered = false;
    }
    this.frameCount++;
  };

  //============================================================================
  // Game_Interpreter
  //============================================================================

  var alias_Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args) {
      alias_Game_Interpreter_pluginCommand.call(this, command, args);
      if(command === "MultipleViewport") {
        switch(args[0]) {
          case 'Enable':
            isMultipleViewport = true;
            Graphics.playAllMovies();
            break;
          case 'Disable':
            isMultipleViewport = false;
            Graphics.pauseAllMovies();
            break;
          case 'StartShake':
            isShake = 1;
            shakePower = Number(args[1] || 10);
            break;
          case 'EndShake':
            isShake = 0;
            break;
          case 'Image':
            var viewID = Number(args[1] || 1);
            var name = args.slice(2, args.length).join(' ');
            var imageName = 'img/pictures/' + name + '.png';
            var texture = PIXI.Texture.fromImage(imageName);
            Graphics.setViewportImage(viewID.clamp(1, 4), texture);
            break;
          case 'ClearImage':
            Graphics.clearViewImage(Number(args[1]));
            break;
          case 'Video':
            var viewID = Number(args[1] || 1);
            var name = args[2];
            var looping = (args[3] === 'true');
            var videoName = 'movies/' + name + '.webm';
            var texture = PIXI.Texture.fromVideoUrl(videoName);
            texture.baseTexture.source.loop = looping;
            Graphics.setViewportImage(viewID.clamp(1, 4), texture);
            break;
          case 'PlayVideo':
            var viewID = Number(args[1] || 1);
            Graphics.playMoviesToCertainView(viewID);
            break;
          case 'PauseVideo':
            var viewID = Number(args[1] || 1);
            Graphics.pauseMoviesToCertainView(viewID);
            break;
          case 'MoveBackSeconds':
            var viewID = Number(args[1] || 1);
            var sec = parseInt(args[2] || 0);
            Graphics.moveMoviesToCertainView(viewID, 'Move Back', sec);
            break;
          case 'MoveForwardSeconds':
            var viewID = Number(args[1] || 1);
            var sec = parseInt(args[2] || 0);
            Graphics.moveMoviesToCertainView(viewID, 'Move Forward', sec);
            break;
          case 'StopVideo':
            var viewID = Number(args[1] || 1);
            Graphics.stopMoviesToCertainView(viewID);
            break;
          case 'ClearVideo':
            var viewID = Number(args[1] || 1);
            Graphics.stopMoviesToCertainView(viewID);
            Graphics.clearViewImage(viewID);
            break;
        }
      }
  };

})();
