/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import BamReaderNonIndexed from "./bamReaderNonIndexed";
import ShardedBamReader from "./shardedBamReader";
import BamReader from "./bamReader";
import BamWebserviceReader from "./bamWebserviceReader";
import HtsgetReader from "./htsgetReader";
import CramReader from "../cram/cramReader";
import Ga4ghAlignmentReader from "../google/ga4ghAlignmentReader";
import BamAlignmentRow from "./bamAlignmentRow";
import PairedAlignment from "./pairedAlignment";
import {isString} from "../util/stringUtils";

const BamSource = function (config, browser) {

    const genome = browser.genome;

    this.config = config;
    this.genome = genome;
    this.alignmentContainer = undefined;

    if (isString(config.url) && config.url.startsWith("data:")) {
        if ("cram" === config.format) {
            throw "CRAM data uris are not supported"
        }
        this.config.indexed = false;
    }

    if ("ga4gh" === config.sourceType) {
        this.bamReader = new Ga4ghAlignmentReader(config, genome);
    } else if ("pysam" === config.sourceType) {
        this.bamReader = new BamWebserviceReader(config, genome)
    } else if ("htsget" === config.sourceType) {
        this.bamReader = new HtsgetReader(config, genome);
    } else if ("shardedBam" === config.sourceType) {
        this.bamReader = new ShardedBamReader(config, genome);
    } else if ("cram" === config.format) {
        this.bamReader = new CramReader(config, genome, browser);
    } else {
        if (this.config.indexed === false) {
            this.bamReader = new BamReaderNonIndexed(config, genome);
        } else {
            this.bamReader = new BamReader(config, genome);
        }
    }

    this.viewAsPairs = config.viewAsPairs;
    this.showSoftClips = config.showSoftClips;
};

BamSource.prototype.setViewAsPairs = function (bool) {
    var self = this;

    if (this.viewAsPairs !== bool) {
        this.viewAsPairs = bool;
        // TODO -- repair alignments
        if (this.alignmentContainer) {
            var alignmentContainer = this.alignmentContainer,
                alignments;

            if (bool) {
                alignments = pairAlignments(alignmentContainer.packedAlignmentRows);
            } else {
                alignments = unpairAlignments(alignmentContainer.packedAlignmentRows);
            }
            alignmentContainer.packedAlignmentRows = packAlignmentRows(alignments, alignmentContainer.start, alignmentContainer.end);

        }
    }

};

BamSource.prototype.setShowSoftClips = function (bool) {

    if (this.showSoftClips !== bool) {

        this.showSoftClips = bool;

        if (this.alignmentContainer) {
            const alignments = allAlignments(this.alignmentContainer.packedAlignmentRows);
            const alignmentContainer = this.alignmentContainer;
            alignmentContainer.packedAlignmentRows = packAlignmentRows(alignments, alignmentContainer.start, alignmentContainer.end, bool);

        }
    }

    function allAlignments(rows) {
        let result = [];
        for (let row of rows) {
            for (let alignment of row.alignments) {
                result.push(alignment);
            }
        }
        return result;
    }
}

BamSource.prototype.getAlignments = async function (chr, bpStart, bpEnd) {

    const self = this;
    const genome = this.genome;
    const showSoftClips = this.showSoftClips;

    if (self.alignmentContainer && self.alignmentContainer.contains(chr, bpStart, bpEnd)) {

        return self.alignmentContainer;

    } else {

        const alignmentContainer = await self.bamReader.readAlignments(chr, bpStart, bpEnd)

        let alignments = alignmentContainer.alignments;

        if (!self.viewAsPairs) {
            alignments = unpairAlignments([{alignments: alignments}]);
        }

        const hasAlignments = alignments.length > 0;

        alignmentContainer.packedAlignmentRows = packAlignmentRows(alignments, alignmentContainer.start, alignmentContainer.end, showSoftClips);

        alignmentContainer.alignments = undefined;  // Don't need to hold onto these anymore

        self.alignmentContainer = alignmentContainer;

        if (!hasAlignments) {

            return alignmentContainer;

        } else {

            const sequence = await genome.sequence.getSequence(chr, alignmentContainer.start, alignmentContainer.end)

            if (sequence) {

                alignmentContainer.coverageMap.refSeq = sequence;    // TODO -- fix this
                alignmentContainer.sequence = sequence;           // TODO -- fix this

                return alignmentContainer;
            } else {
                console.error("No sequence for: " + chr + ":" + alignmentContainer.start + "-" + alignmentContainer.end)
            }

        }

    }

}

function pairAlignments(rows) {

    var pairCache = {},
        result = [];

    rows.forEach(function (row) {

        row.alignments.forEach(function (alignment) {

            var pairedAlignment;

            if (canBePaired(alignment)) {

                pairedAlignment = pairCache[alignment.readName];
                if (pairedAlignment) {
                    pairedAlignment.setSecondAlignment(alignment);
                    pairCache[alignment.readName] = undefined;   // Don't need to track this anymore.
                } else {
                    pairedAlignment = new PairedAlignment(alignment);
                    pairCache[alignment.readName] = pairedAlignment;
                    result.push(pairedAlignment);
                }
            } else {
                result.push(alignment);
            }
        });
    });
    return result;
}

function unpairAlignments(rows) {
    var result = [];
    rows.forEach(function (row) {
        row.alignments.forEach(function (alignment) {
            if (alignment instanceof PairedAlignment) {
                if (alignment.firstAlignment) result.push(alignment.firstAlignment);  // shouldn't need the null test
                if (alignment.secondAlignment) result.push(alignment.secondAlignment);

            } else {
                result.push(alignment);
            }
        });
    });
    return result;
}

function canBePaired(alignment) {
    return alignment.isPaired() &&
        alignment.isMateMapped() &&
        alignment.chr === alignment.mate.chr &&
        (alignment.isFirstOfPair() || alignment.isSecondOfPair()) && !(alignment.isSecondary() || alignment.isSupplementary());
}

function packAlignmentRows(alignments, start, end, showSoftClips) {

    if (!alignments) return;


    if (alignments.length === 0) {
        return [];
    } else {

        var bucketList = [],
            allocatedCount = 0,
            lastAllocatedCount = 0,
            nextStart,
            alignmentRow,
            index,
            bucket,
            alignment,
            alignmentSpace = 8,
            packedAlignmentRows = [],
            bucketStart;


        alignments.sort(function (a, b) {
            return showSoftClips ? a.scStart - b.scStart : a.start - b.start;
        });

        // bucketStart = Math.max(start, alignments[0].start);
        const firstAlignment = alignments[0];
        bucketStart = Math.max(start, showSoftClips ? firstAlignment.scStart : firstAlignment.start);
        nextStart = bucketStart;

        alignments.forEach(function (alignment) {

            //var buckListIndex = Math.max(0, alignment.start - bucketStart);
            const s = showSoftClips ? alignment.scStart : alignment.start;
            var buckListIndex = Math.max(0, s - bucketStart);
            if (bucketList[buckListIndex] === undefined) {
                bucketList[buckListIndex] = [];
            }
            bucketList[buckListIndex].push(alignment);
        });


        while (allocatedCount < alignments.length) {

            alignmentRow = new BamAlignmentRow();

            while (nextStart <= end) {

                bucket = undefined;

                while (!bucket && nextStart <= end) {

                    index = nextStart - bucketStart;
                    if (bucketList[index] === undefined) {
                        ++nextStart;                     // No alignments at this index
                    } else {
                        bucket = bucketList[index];
                    }

                } // while (bucket)

                if (!bucket) {
                    break;
                }
                alignment = bucket.pop();
                if (0 === bucket.length) {
                    bucketList[index] = undefined;
                }

                alignmentRow.alignments.push(alignment);

                nextStart = showSoftClips ?
                    alignment.scStart + alignment.scLengthOnRef + alignmentSpace :
                    alignment.start + alignment.lengthOnRef + alignmentSpace;
                ++allocatedCount;

            } // while (nextStart)

            if (alignmentRow.alignments.length > 0) {
                packedAlignmentRows.push(alignmentRow);
            }

            nextStart = bucketStart;

            if (allocatedCount === lastAllocatedCount) break;   // Protect from infinite loops

            lastAllocatedCount = allocatedCount;

        } // while (allocatedCount)

        return packedAlignmentRows;
    }
}


export default BamSource;
