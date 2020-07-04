/* exported initPhotoSwipeFromDOM */
/* global photoBooth */
function initPhotoSwipeFromDOM (gallerySelector) {

    var gallery,
        ssRunning = false,
        ssOnce = false;

    const ssDelay = config.slideshow_pictureTime,
        ssButtonClass = '.pswp__button--playpause';

    const parseThumbnailElements = function (container) {
        return $(container).find('>a').map(function () {
            const element = $(this);

            const size = element.attr('data-size').split('x');
            const medSize = element.attr('data-med-size').split('x');

            // create slide object
            const item = {
                element: element.get(0),
                src: element.attr('href'),
                w: parseInt(size[0], 10),
                h: parseInt(size[1], 10),
                msrc: element.find('>img').attr('src'),
                mediumImage: {
                    src: element.attr('data-med'),
                    w: parseInt(medSize[0], 10),
                    h: parseInt(medSize[1], 10)
                }
            };

            item.originalImage = {
                src: item.src,
                w: item.w,
                h: item.h
            };

            return item;
        }).get();
    };

    const onThumbnailClick = function (ev) {
        ev.preventDefault();

        const element = $(ev.target).closest('a');
        const index = $(gallerySelector).find('>a').index(element);

        openPhotoSwipe(index);
    };

    const openPhotoSwipe = function (index) {
        const pswpElement = $('.pswp').get(0);
        const items = parseThumbnailElements(gallerySelector);

        const options = {
            index: index,

            getThumbBoundsFn: function (thumbIndex) {
                // See Options->getThumbBoundsFn section of docs for more info
                const thumbnail = items[thumbIndex].element.children[0],
                    pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
                    rect = thumbnail.getBoundingClientRect();

                return {
                    x: rect.left,
                    y: rect.top + pageYScroll,
                    w: rect.width
                };
            },

            shareEl: false,
            zoomEl: false,
            fullscreenEl: false,
            tapToToggleControls: false
        };

        // Pass data to PhotoSwipe and initialize it
        gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);

        // Slideshow not running from the start
        setSlideshowState(ssButtonClass, false);

        // see: http://photoswipe.com/documentation/responsive-images.html
        var realViewportWidth,
            useLargeImages = false,
            firstResize = true,
            imageSrcWillChange;

        gallery.listen('beforeResize', function () {

            var dpiRatio = window.devicePixelRatio ? window.devicePixelRatio : 1;
            dpiRatio = Math.min(dpiRatio, 2.5);
            realViewportWidth = gallery.viewportSize.x * dpiRatio;


            if (realViewportWidth >= 1200 || (!gallery.likelyTouchDevice && realViewportWidth > 800) || screen.width > 1200) {
                if (!useLargeImages) {
                    useLargeImages = true;
                    imageSrcWillChange = true;
                }

            } else if (useLargeImages) {
                useLargeImages = false;
                imageSrcWillChange = true;
            }

            if (imageSrcWillChange && !firstResize) {
                gallery.invalidateCurrItems();
            }

            if (firstResize) {
                firstResize = false;
            }

            imageSrcWillChange = false;

        });

        gallery.listen('gettingData', function (_index, item) {
            if (useLargeImages) {
                item.src = item.originalImage.src;
                item.w = item.originalImage.w;
                item.h = item.originalImage.h;
            } else {
                item.src = item.mediumImage.src;
                item.w = item.mediumImage.w;
                item.h = item.mediumImage.h;
            }
        });

        gallery.listen('afterChange', function() {
            const img = gallery.currItem.src.split('\\').pop().split('/').pop();

            $('.pswp__button--download').attr({
                href: 'api/download.php?image=' + img,
                download: img,
            });

            if (ssRunning && ssOnce) {
                ssOnce = false;
                setTimeout(gotoNextSlide, ssDelay);
            }
        });

        const resetMailForm = function () {
            $('.pswp__qr').removeClass('qr-active').fadeOut('fast');

            photoBooth.resetMailForm();

            $('.send-mail').removeClass('mail-active').fadeOut('fast');
        };

        gallery.listen('beforeChange', resetMailForm);
        gallery.listen('close', resetMailForm);

        gallery.init();
    };

    // QR in gallery
    $('.pswp__button--qrcode').on('click touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const pswpQR = $('.pswp__qr');

        if (pswpQR.hasClass('qr-active')) {
            pswpQR.removeClass('qr-active').fadeOut('fast');
        } else {
            pswpQR.empty();
            var img = gallery.currItem.src;
            img = img.split('\\').pop().split('/').pop();

            $('<img>').attr('src', 'api/qrcode.php?filename=' + img).appendTo(pswpQR);

            pswpQR.addClass('qr-active').fadeIn('fast');
        }
    });

    // print in gallery
    $('.pswp__button--print').on('click touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const img = gallery.currItem.src.split('\\').pop().split('/').pop();

        photoBooth.printImage(img, function() {
            gallery.close();
        });
    });

    // Close Gallery while Taking a Picture or Collage
    $('.closeGallery').on('click', function (e) {
        e.preventDefault();

        gallery.close();
    });

    // chroma keying print
    $('.pswp__button--print-chroma-keying').on('click touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const img = gallery.currItem.src.split('\\').pop().split('/').pop();

        if (config.chroma_keying) {
            location = 'chromakeying.php?filename=' + encodeURI(img);
        }
    });

    $('.pswp__button--mail').on('click touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const img = gallery.currItem.src.split('\\').pop().split('/').pop();

        photoBooth.toggleMailDialog(img);
    });

    /* slideshow management */
    $(ssButtonClass).on('click touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // toggle slideshow on/off
        $('.pswp__button--playpause').toggleClass('fa-play fa-pause');
        setSlideshowState(this, !ssRunning);
    });

    function setSlideshowState(el, running) {
        if (running) {
            setTimeout(gotoNextSlide, ssDelay / 2.0);
        }
        const title = running ? 'Pause Slideshow' : 'Play Slideshow';
        $(el).prop('title', title);
        ssRunning = running;
    }

    function gotoNextSlide() {
        if (ssRunning && Boolean(gallery)) {
            ssOnce = true;
            gallery.next();
        }
    }

    $(gallerySelector).on('click', onThumbnailClick);
}

