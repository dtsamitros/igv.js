/**
 * Created by turner on 2/24/14.
 */
var igv = (function (igv) {


    var coverageColor;
    var mismatchColor = "rgb(255, 0, 0)";
    var alignmentColor = "rgb(185, 185, 185)";
    var negStrandColor = "rgb(150, 150, 230)";
    var posStrandColor = "rgb(230, 150, 150)";
    var deletionColor = "black";
    var skippedColor = "rgb(150, 170, 170)";
    var expandedHeight = 14;

    igv.BAMTrack = function (descriptor) {

        var coverageTrackHeightPercentage, alignmentTrackHeightPercentage;

        this.doPopup = (descriptor.doPopup) ? descriptor.doPopup : false;
        this.descriptor = descriptor;
        this.url = descriptor.url;
        this.featureSource = new igv.BamSource(this.url);
        this.label = descriptor.label || "";
        this.id = descriptor.id || this.label;
        this.height = 400;
        this.alignmentRowHeight = expandedHeight;
        this.alignmentRowYInset = 1;

        // divide the canvas into a coverage track region and an alignment track region
        coverageTrackHeightPercentage = 0.15;
        alignmentTrackHeightPercentage = 1.0 - coverageTrackHeightPercentage;

        this.coverageTrackHeight = coverageTrackHeightPercentage * this.height;
        this.alignmentTrackHeight = alignmentTrackHeightPercentage * this.height;

    };

    igv.BAMTrack.prototype.draw = function (canvas, refFrame, bpStart, bpEnd, width, height, continuation, task) {

//        console.log("bamTrack.draw");


        // Don't try to draw alignments for windows > 10kb
        if (bpEnd - bpStart > 30000) {

            canvas.fillText("Zoom in to see alignments", 600, 20);
            continuation();
            return;
        }

        var myself = this,
            chr = refFrame.chr;

        this.featureSource.getFeatures(chr, bpStart, bpEnd, function (alignmentManager, task) {

            if (alignmentManager) {

//                console.log("bamTrack.featureSource.getSequence", chr, igv.numberFormatter(bpStart), igv.numberFormatter(bpEnd));

                igv.sequenceSource.getSequence(chr, bpStart, bpEnd, function (refSeq) {

                    var coverageMap = alignmentManager.coverageMap,
                        bp,
                        x,
                        y,
                        w,
                        h,
                        base,
                        i,
                        len,
                        item,
                        acc;

                    if (refSeq) {
                        refSeq = refSeq.toUpperCase();
                    }

                    // coverage track
                    canvas.setProperties({ fillStyle: alignmentColor });
                    canvas.setProperties({ strokeStyle: alignmentColor });
                    for (i = 0, len = coverageMap.coverage.length; i < len; i++) {

                        item = coverageMap.coverage[i];
                        if (!item) continue;

                        bp = (coverageMap.bpStart + i);
                        if (bp < bpStart) continue;
                        if (bp > bpEnd) break;

                        x = refFrame.toPixels(bp - bpStart);

                        coverageColor = alignmentColor;
                        canvas.setProperties({   fillStyle: coverageColor });
                        canvas.setProperties({ strokeStyle: coverageColor });

                        h = (item.total / coverageMap.maximum) * myself.coverageTrackHeight;
                        y = myself.coverageTrackHeight - h;

                        if (refFrame.bpPerPixel > 1) {

                            canvas.strokeLine(x, y, x, y + h);
                        } else {

                            canvas.fillRect(x, y, 1.0 / refFrame.bpPerPixel, h);

                            if ((1.0 / refFrame.bpPerPixel) > 4.0) {
                                canvas.strokeLine(x, y, x, y + h, { strokeStyle: igv.greyScale(255) });
                            }

                        }

                    }

                    // coverage mismatch coloring
                    if (refSeq) {
                        for (i = 0, len = coverageMap.coverage.length; i < len; i++) {

                            item = coverageMap.coverage[i];
                            if (!item) continue;

                            bp = (coverageMap.bpStart + i);
                            if (bp < bpStart) continue;
                            if (bp > bpEnd) break;

                            base = refSeq[i + coverageMap.bpStart - bpStart];

                            if (item.isMismatch(base)) {

                                x = refFrame.toPixels(bp - bpStart);
                                w = Math.max(1, 1.0 / refFrame.bpPerPixel);

                                acc = 0.0;
                                coverageMap.coverage[i].mismatchPercentages(base).forEach(function (fraction, index, fractions) {

                                    if (fraction.percent < 0.001) {
                                        return;
                                    }

                                    h = fraction.percent * (item.total / coverageMap.maximum) * myself.coverageTrackHeight;
                                    y = (myself.coverageTrackHeight - h) - acc;
                                    acc += h;

                                    canvas.setProperties({ fillStyle: igv.nucleotideColors[ fraction.base ] });
                                    canvas.fillRect(x, y, w, h);

                                });


                            }
                        }
                    }

                    // alignment track
                    alignmentManager.genomicInterval.packedAlignments.forEach(function renderAlignmentRow(alignmentRow, packedAlignmentIndex, packedAlignments) {

                        var arrowHeadWidth = myself.alignmentRowHeight / 2.0,
                            yStrokedLine,
                            yRect,
                            height;

                        yRect = myself.alignmentRowYInset + myself.coverageTrackHeight + (myself.alignmentRowHeight * packedAlignmentIndex);
                        height = myself.alignmentRowHeight - (2 * myself.alignmentRowYInset);

                        yStrokedLine = (height / 2.0) + yRect;

                        alignmentRow.forEach(function renderAlignment(alignment) {

                            var xRectStart,
                                xRectEnd,
                                blocks = alignment.blocks,
                                len = alignment.blocks.length,
                                strand = alignment.strand,
                                blocksBBoxLength = alignmentManager.alignmentBlocksBBoxLength(alignment);

                            if ((alignment.start + blocksBBoxLength) < bpStart) return;
                            if (alignment.start > bpEnd) return;

                            xRectStart = refFrame.toPixels(alignment.start - bpStart);
                            xRectEnd = refFrame.toPixels((alignment.start + blocksBBoxLength) - bpStart);

                            if (blocks.length > 0) {
                                // todo -- set color based on gap type (deletion or skipped)
                                canvas.strokeLine(xRectStart, yStrokedLine, xRectEnd, yStrokedLine, {strokeStyle: skippedColor});
                            }

                            canvas.setProperties({fillStyle: alignmentColor});

                            blocks.forEach(function renderAlignmentBlocks(block, blockIndex) {

                                var refOffset = block.start - bpStart,
                                    blockRectX = refFrame.toPixels(refOffset),
                                    blockEndX = refFrame.toPixels((block.start + block.len) - bpStart),
                                    blockRectWidth = Math.max(1, blockEndX - blockRectX),
                                    blockSeq = block.seq.toUpperCase(),
                                    blockQual = block.qual,
                                    refChar,
                                    readChar,
                                    readQual,
                                    basePixelPosition,
                                    basePixelWidth,
                                    baseColor,
                                    i;


                                if (strand && blockIndex === len - 1) {

                                    x = [xRectStart, xRectEnd, xRectEnd + arrowHeadWidth, xRectEnd, xRectStart];
                                    y = [yRect, yRect, yRect + height / 2, yRect + height, yRect + height];
                                    canvas.fillPolygon(x, y);
                                } else if (!strand && blockIndex === 0) {

                                    var x = [ blockRectX - arrowHeadWidth, blockRectX, blockEndX, blockEndX, blockRectX];
                                    var y = [ yRect + height / 2, yRect, yRect, yRect + height, yRect + height];
                                    canvas.fillPolygon(x, y);
                                } else {
                                    canvas.fillRect(blockRectX, yRect, blockRectWidth, height);
                                }

                                // Only do mismatch coloring if a refseq exists to do the comparison
                                if (refSeq && blockSeq !== "*") {

                                    for (i = 0, len = blockSeq.length; i < len; i++) {

                                        readChar = blockSeq.charAt(i);
                                        refChar = refSeq.charAt(refOffset + i);

                                        if (readChar === "=") {
                                            readChar = refChar;
                                        }

                                        if (readChar === "X" || refChar !== readChar) {

                                            if (blockQual && blockQual.length > i) {
                                                readQual = blockQual.charCodeAt(i);
                                                baseColor = shadedBaseColor(readQual, readChar);
                                            }
                                            else {
                                                baseColor = igv.nucleotideColors[readChar];
                                            }
                                            if (!baseColor) baseColor = "gray";

                                            basePixelPosition = refFrame.toPixels((block.start + i) - bpStart);
                                            basePixelWidth = Math.max(1, refFrame.toPixels(1));

                                            canvas.fillRect(basePixelPosition, yRect, basePixelWidth, height, { fillStyle: baseColor });

                                        }
                                    }

                                } // if (refSeq)

                            });
                        });

                    });


                    continuation();

                });

            } else {
                continuation();
            }

        });
    };

    igv.BAMTrack.prototype.drawLabel = function (ctx) {
        // draw label stuff
    };

    igv.BAMTrack.prototype.popupString = function (genomicLocation, xOffset, yOffset) {

        var alignmentManager = this.featureSource.alignmentManager,
            coverageMap = alignmentManager.coverageMap,
            coverageMapIndex,
            coverage,
            packedAlignments = alignmentManager.genomicInterval.packedAlignments,
            packedAlignmentsIndex,
            alignmentRow,
            alignmentHitTest,
            readChar,
            markup = undefined,
            refSeqIndex;

        packedAlignmentsIndex = Math.floor((yOffset - (this.alignmentRowYInset + this.coverageTrackHeight)) / this.alignmentRowHeight);

        if (packedAlignmentsIndex >= packedAlignments.length) {

            return undefined;
        }

        if (packedAlignmentsIndex < 0) {

            coverageMapIndex = genomicLocation - coverageMap.bpStart;
            coverage = coverageMap.coverage[ coverageMapIndex ];

            if (undefined === coverage) {
                return undefined;
            }

            markup = "<span class=\"popoverContentSpan\">Total Count</span> " + coverage.total + "<br>";

            // A
            markup += "<span class=\"popoverContentSpan\">A</span> " + (coverage.posA + coverage.negA);
            if (coverage.posA + coverage.negA) {
                markup += " (" + Math.floor(((coverage.posA + coverage.negA) / coverage.total) * 100.0) + "%)" + "<br>";
            } else {
                markup += "<br>";
            }

            // C
            markup += "<span class=\"popoverContentSpan\">C</span> " + (coverage.posC + coverage.negC);
            if (coverage.posC + coverage.negC) {
                markup += " (" + Math.floor(((coverage.posC + coverage.negC) / coverage.total) * 100.0) + "%)" + "<br>";
            } else {
                markup += "<br>";
            }

            // G
            markup += "<span class=\"popoverContentSpan\">G</span> " + (coverage.posG + coverage.negG);
            if (coverage.posG + coverage.negG) {
                markup += " (" + Math.floor(((coverage.posG + coverage.negG) / coverage.total) * 100.0) + "%)" + "<br>";
            } else {
                markup += "<br>";
            }

            // T
            markup += "<span class=\"popoverContentSpan\">T</span> " + (coverage.posT + coverage.negT);
            if (coverage.posT + coverage.negT) {
                markup += " (" + Math.floor(((coverage.posT + coverage.negT) / coverage.total) * 100.0) + "%)" + "<br>";
            } else {
                markup += "<br>";
            }

            // N
            markup += "<span class=\"popoverContentSpan\">N</span> " + (coverage.posN + coverage.negN);
            if (coverage.posN + coverage.negN) {
                markup += " (" + Math.floor(((coverage.posN + coverage.negN) / coverage.total) * 100.0) + "%)" + "<br>";
            } else {
                markup += "<br>";
            }


            return markup;
        }

        else {

            alignmentRow = packedAlignments[ packedAlignmentsIndex ];

            readChar = undefined;
            alignmentRow.forEach(function (alignment, alignmentIndex, alignments) {

                if (undefined === readChar) {

                    readChar = alignmentManager.alignmentBlockHitTest(alignment, genomicLocation);
                    alignmentHitTest = alignment;
                }

            });

            if (readChar) {
                markup = "<span class=\"popoverContentSpan\">Sample</span> " + this.label + "<br>";
                markup += "<span class=\"popoverContentSpan\">Location</span> " + alignmentManager.genomicInterval.chr + ":" + igv.numberFormatter(genomicLocation) + "<br>";
                markup += "<span class=\"popoverContentSpan\">Alignment Start</span> " + igv.numberFormatter(alignmentHitTest.start);
                if (true === alignmentHitTest.strand) {
                    markup += "(+)" + "<br>";
                } else {
                    markup += "(-)" + "<br>";

                }
                markup += "<span class=\"popoverContentSpan\">Cigar</span> " + alignmentHitTest.cigar + "<br>";
                markup += "<span class=\"popoverContentSpan\">Mapping Quality</span> " + alignmentHitTest.mq + "<br>";
                markup += "<span class=\"popoverContentSpan\">Base</span> " + readChar;

//            refSeqIndex = genomicLocation - alignmentManager.coverageMap.bpStart;
//            markup += "ref seq base " + alignmentManager.coverageMap.refSeq[ refSeqIndex ];

            }

            return markup;
        }
    };

    function shadedBaseColor(qual, nucleotide) {

        var color,
            alpha,
            minQ = 5,   //prefs.getAsInt(PreferenceManager.SAM_BASE_QUALITY_MIN),
            maxQ = 20,  //prefs.getAsInt(PreferenceManager.SAM_BASE_QUALITY_MAX);
            foregroundColor = igv.nucleotideColorComponents[nucleotide],
            backgroundColor = [255, 255, 255];   // White

        if (!foregroundColor) return "grey";

        if (qual < minQ) {
            alpha = 0.1;
        } else {
            alpha = Math.max(0.1, Math.min(1.0, 0.1 + 0.9 * (qual - minQ) / (maxQ - minQ)));
        }
        // Round alpha to nearest 0.1
        alpha = Math.round(alpha * 10) / 10.0;

        if (alpha >= 1) {
            return igv.nucleotideColors[nucleotide];
        }
        color = igv.getCompositeColor(backgroundColor, foregroundColor, alpha);
        return color;
    }

    return igv;

})(igv || {});
