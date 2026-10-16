<script setup>
import { projects, projectsIssueUrl } from '../../projects.js'

defineOptions({ name: 'ProjectsUsingPivotick' })
</script>

<template>
    <div class="pvt-projects">
        <p class="pvt-projects__intro">
            See how the community uses Pivotick to explore connected data, from
            threat intelligence to security investigations. These projects are
            featured in our <a :href="projectsIssueUrl">community project list</a>.
        </p>

        <ul class="pvt-projects__grid">
            <li v-for="project in projects" :key="project.name" class="pvt-projects__card">
                <a :href="project.url" class="pvt-projects__link">
                    <span class="pvt-projects__badge" aria-hidden="true">{{ project.initials }}</span>
                    <strong class="pvt-projects__name">{{ project.name }}</strong>
                    <span class="pvt-projects__description">{{ project.description }}</span>
                    <span class="pvt-projects__visit">Explore project <span aria-hidden="true">→</span></span>
                </a>
                <div v-if="project.repository || project.instance" class="pvt-projects__extra">
                    <a v-if="project.repository" :href="project.repository">Source code</a>
                    <a v-if="project.instance" :href="project.instance">CIRCL instance</a>
                </div>
            </li>
        </ul>

        <div class="pvt-projects__invite">
            <p class="pvt-projects__invite-title">Building something with Pivotick?</p>
            <p>
                We'd love to feature it here. Share your project's name, a link and
                a short description of how you use Pivotick in
                <a :href="projectsIssueUrl">issue #34</a>. Projects of all sizes are welcome!
            </p>
            <a class="pvt-projects__button" :href="projectsIssueUrl">Share your project <span aria-hidden="true">→</span></a>
        </div>
    </div>
</template>

<style scoped>
.pvt-projects__intro {
    margin: 0 0 24px;
    color: var(--vp-c-text-2);
    line-height: 1.7;
}

.pvt-projects a {
    color: var(--vp-c-brand-1);
}

.pvt-projects__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 16px;
    padding: 0;
    margin: 0;
    list-style: none;
}

.pvt-projects__card {
    display: flex;
    flex-direction: column;
    margin: 0;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    background: var(--vp-c-bg-soft);
    transition: border-color 0.2s;
}

.pvt-projects__card:hover,
.pvt-projects__card:focus-within {
    border-color: var(--vp-c-brand-1);
}

.pvt-projects__link {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    padding: 24px;
    text-decoration: none;
}

.pvt-projects__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    border-radius: 12px;
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
    font-size: 14px;
    font-weight: 700;
}

.pvt-projects__name {
    color: var(--vp-c-text-1);
    font-size: 17px;
    line-height: 1.5;
}

.pvt-projects__description {
    margin: 8px 0 20px;
    color: var(--vp-c-text-2);
    font-size: 14px;
    line-height: 1.7;
}

.pvt-projects__visit {
    margin-top: auto;
    font-size: 14px;
    font-weight: 600;
}

.pvt-projects__extra {
    padding: 0 24px 20px;
    font-size: 13px;
}

.pvt-projects__invite {
    padding: 24px;
    margin-top: 24px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    background: var(--vp-c-bg-soft);
}

.pvt-projects__invite-title {
    margin: 0 0 8px;
    color: var(--vp-c-text-1);
    font-size: 18px;
    font-weight: 600;
}

.pvt-projects__invite p:not(.pvt-projects__invite-title) {
    margin: 0 0 16px;
    color: var(--vp-c-text-2);
    line-height: 1.7;
}

.pvt-projects a.pvt-projects__button {
    display: inline-block;
    padding: 8px 20px;
    border-radius: 20px;
    background: var(--vp-button-brand-bg);
    color: var(--vp-button-brand-text);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
}

.pvt-projects__button:hover {
    background: var(--vp-button-brand-hover-bg);
}

.pvt-projects a:focus-visible {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 4px;
}
</style>
