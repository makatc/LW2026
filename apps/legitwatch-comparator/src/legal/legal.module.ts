import { Module } from '@nestjs/common';
import { LawParserService } from './law-parser.service';
import { ModeClassifierService } from './mode-classifier.service';
import { PatchExtractorService } from './patch-extractor.service';
import { PatchApplierService } from './patch-applier.service';
import { LocalizedDiffService } from './localized-diff.service';
import { LegalComparatorService } from './legal-comparator.service';
import { DiffService } from '../comparison/services/diff.service';

/**
 * LegalModule
 * Encapsulates the Legal Patch Engine.
 * Import into AppModule (or ComparisonModule) to enable PATCH mode.
 *
 * Feature flag: LEGAL_PATCH_ENGINE_ENABLED=true
 */
@Module({
  providers: [
    DiffService,
    LawParserService,
    ModeClassifierService,
    PatchExtractorService,
    PatchApplierService,
    LocalizedDiffService,
    LegalComparatorService,
  ],
  exports: [
    LawParserService,
    ModeClassifierService,
    PatchExtractorService,
    PatchApplierService,
    LocalizedDiffService,
    LegalComparatorService,
  ],
})
export class LegalModule {}
