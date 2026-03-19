import { describe, expect, it } from 'vitest';
import { ReviewDecision } from '@/apps/control-api/domain/experiment';
import { ExperimentController } from '@/apps/control-api/presentation/experiment/experiment.controller';
import { ok, type Result } from '@/shared/domain/common';

type AnyResult = Result<unknown, never>;
class UseCaseStub<TInput = unknown> {
  lastInput: TInput | null = null;
  result: AnyResult = ok(undefined);
  async execute(input: TInput): Promise<AnyResult> {
    this.lastInput = input;
    return this.result;
  }
}
function setupController() {
  const createExperiment = new UseCaseStub();
  const updateExperiment = new UseCaseStub();
  const submitForReview = new UseCaseStub();
  const submitReview = new UseCaseStub();
  const startExperiment = new UseCaseStub();
  const pauseExperiment = new UseCaseStub();
  const resumeExperiment = new UseCaseStub();
  const completeExperiment = new UseCaseStub();
  const archiveExperiment = new UseCaseStub();
  const getExperiment = new UseCaseStub();
  const listExperiments = new UseCaseStub();
  const listReviewsUseCase = new UseCaseStub();
  const controller = new ExperimentController(
    createExperiment as never,
    updateExperiment as never,
    submitForReview as never,
    submitReview as never,
    startExperiment as never,
    pauseExperiment as never,
    resumeExperiment as never,
    completeExperiment as never,
    archiveExperiment as never,
    getExperiment as never,
    listExperiments as never,
    listReviewsUseCase as never,
  );
  return {
    controller,
    createExperiment,
    updateExperiment,
    submitForReview,
    submitReview,
    startExperiment,
    pauseExperiment,
    resumeExperiment,
    completeExperiment,
    archiveExperiment,
    getExperiment,
    listExperiments,
    listReviewsUseCase,
  };
}
describe('ExperimentController', () => {
  it('maps create payload and applies defaults for optional fields', async () => {
    const { controller, createExperiment } = setupController();
    createExperiment.result = ok({ id: 'exp-1' });
    const created = await controller.create('actor-1', {
      name: 'New experiment',
      flagId: 'flag-1',
      audiencePercent: 100,
      variants: [],
    } as never);
    expect(created).toEqual({ id: 'exp-1' });
    expect(createExperiment.lastInput).toEqual({
      actorId: 'actor-1',
      name: 'New experiment',
      description: null,
      flagId: 'flag-1',
      conflictDomain: null,
      priority: null,
      audiencePercent: 100,
      targetingRule: null,
      variants: [],
      metricIds: [],
      primaryMetricId: null,
    });
    await controller.create('actor-1', {
      name: 'New experiment',
      description: 'desc',
      flagId: 'flag-1',
      conflictDomain: 'checkout',
      priority: 20,
      audiencePercent: 80,
      targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
      variants: [{ name: 'A', value: 'a', weight: 80, isControl: true }],
      metricIds: ['m1'],
      primaryMetricId: 'm1',
    } as never);
    expect(createExperiment.lastInput).toEqual({
      actorId: 'actor-1',
      name: 'New experiment',
      description: 'desc',
      flagId: 'flag-1',
      conflictDomain: 'checkout',
      priority: 20,
      audiencePercent: 80,
      targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
      variants: [{ name: 'A', value: 'a', weight: 80, isControl: true }],
      metricIds: ['m1'],
      primaryMetricId: 'm1',
    });
  });
  it('forwards list/get/update/submit/listReviews requests', async () => {
    const {
      controller,
      listExperiments,
      getExperiment,
      updateExperiment,
      submitForReview,
      listReviewsUseCase,
    } = setupController();
    listExperiments.result = ok({ data: [], total: 0, limit: 20, offset: 0 });
    getExperiment.result = ok({ id: 'exp-1' });
    listReviewsUseCase.result = ok({ data: [], total: 0, limit: 10, offset: 0 });
    await controller.list('flag-1', undefined, 'owner-1', 5, 2);
    expect(listExperiments.lastInput).toEqual({
      flagId: 'flag-1',
      status: undefined,
      ownerId: 'owner-1',
      limit: 5,
      offset: 2,
    });
    await controller.get('exp-1');
    expect(getExperiment.lastInput).toEqual({ experimentId: 'exp-1' });
    const updateResult = await controller.update('actor-1', 'exp-1', {
      name: 'Updated',
      description: null,
      audiencePercent: 70,
      targetingRule: null,
      metricIds: ['m1'],
      primaryMetricId: 'm1',
    } as never);
    expect(updateResult).toEqual({ success: true });
    expect(updateExperiment.lastInput).toEqual({
      actorId: 'actor-1',
      experimentId: 'exp-1',
      name: 'Updated',
      description: null,
      audiencePercent: 70,
      targetingRule: null,
      metricIds: ['m1'],
      primaryMetricId: 'm1',
    });
    const submitResult = await controller.submit('actor-1', 'exp-1');
    expect(submitResult).toEqual({ success: true });
    expect(submitForReview.lastInput).toEqual({ actorId: 'actor-1', experimentId: 'exp-1' });
    await controller.listReviews('exp-1', 3, 1);
    expect(listReviewsUseCase.lastInput).toEqual({ experimentId: 'exp-1', limit: 3, offset: 1 });
  });
  it('maps review lifecycle decision commands', async () => {
    const {
      controller,
      submitReview,
      startExperiment,
      pauseExperiment,
      resumeExperiment,
      completeExperiment,
      archiveExperiment,
    } = setupController();
    const approve = await controller.approve('actor-1', 'exp-1', { comment: 'ok' } as never);
    const reject = await controller.reject('actor-1', 'exp-1', { comment: 'no' } as never);
    const requestChanges = await controller.requestChanges('actor-1', 'exp-1', {
      comment: 'please fix',
    } as never);
    expect(approve).toEqual({ success: true });
    expect(reject).toEqual({ success: true });
    expect(requestChanges).toEqual({ success: true });
    expect(submitReview.lastInput).toEqual({
      actorId: 'actor-1',
      experimentId: 'exp-1',
      decision: ReviewDecision.CHANGES_REQUESTED,
      comment: 'please fix',
    });
    const started = await controller.start('actor-1', 'exp-1');
    const paused = await controller.pause('actor-1', 'exp-1');
    const resumed = await controller.resume('actor-1', 'exp-1');
    expect(started).toEqual({ success: true });
    expect(paused).toEqual({ success: true });
    expect(resumed).toEqual({ success: true });
    expect(startExperiment.lastInput).toEqual({ actorId: 'actor-1', experimentId: 'exp-1' });
    expect(pauseExperiment.lastInput).toEqual({ actorId: 'actor-1', experimentId: 'exp-1' });
    expect(resumeExperiment.lastInput).toEqual({ actorId: 'actor-1', experimentId: 'exp-1' });
    const completed = await controller.complete('actor-1', 'exp-1', {
      outcomeType: 'ROLLBACK',
      comment: 'rolled back',
    } as never);
    expect(completed).toEqual({ success: true });
    expect(completeExperiment.lastInput).toEqual({
      actorId: 'actor-1',
      experimentId: 'exp-1',
      outcomeType: 'ROLLBACK',
      winnerVariantId: null,
      comment: 'rolled back',
    });
    const archived = await controller.archive('actor-1', 'exp-1');
    expect(archived).toEqual({ success: true });
    expect(archiveExperiment.lastInput).toEqual({ actorId: 'actor-1', experimentId: 'exp-1' });
  });
});
