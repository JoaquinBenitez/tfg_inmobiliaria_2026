import { SyndicationChannel } from '../../interfaces/syndicationChannel';
import { JobChannel, JOB_CHANNELS } from '../../domain/syndicationTypes';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MetaGraphChannel } from './metaGraphAdapter';
import { XmlFeedChannel } from './xmlFeedAdapter';
import { JsonFeedChannel } from './jsonFeedAdapter';

/**
 * Fábrica que refleja imageStorageFactory: un único lugar donde se construyen los
 * adaptadores de canales externos. Los canales habilitados vienen de SYNDICATION_CHANNELS;
 * el map solo contiene siempre adaptadores habilitados.
 */
export class SyndicationChannelFactory {
    private static channels: Map<JobChannel, SyndicationChannel> | null = null;

    static enabledChannels(): JobChannel[] {
        const requested = env.SYNDICATION_CHANNELS;
        const unknown = requested.filter(name => !JOB_CHANNELS.includes(name as JobChannel));
        if (unknown.length > 0) {
            logger.warn({ unknown, valid: JOB_CHANNELS }, 'Unknown SYNDICATION_CHANNELS entries ignored');
        }
        return requested.filter((name): name is JobChannel => JOB_CHANNELS.includes(name as JobChannel));
    }

    static getChannels(): Map<JobChannel, SyndicationChannel> {
        if (!this.channels) {
            const channels = new Map<JobChannel, SyndicationChannel>();
            for (const name of this.enabledChannels()) {
                channels.set(name, this.build(name));
            }
            this.channels = channels;
        }
        return this.channels;
    }

    private static build(name: JobChannel): SyndicationChannel {
        switch (name) {
            case 'meta-graph':
                return new MetaGraphChannel();
            case 'xml-feed':
                return new XmlFeedChannel();
            case 'json-feed':
                return new JsonFeedChannel();
        }
    }

    static resetInstance(): void {
        this.channels = null;
    }
}
